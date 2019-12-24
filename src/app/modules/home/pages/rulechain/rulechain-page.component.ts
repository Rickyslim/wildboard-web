///
/// Copyright © 2016-2019 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding, Inject,
  OnInit,
  QueryList, SkipSelf,
  ViewChild,
  ViewChildren,
  ViewEncapsulation
} from '@angular/core';
import { PageComponent } from '@shared/components/page.component';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { HasDirtyFlag } from '@core/guards/confirm-on-exit.guard';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog, MatExpansionPanel, ErrorStateMatcher, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { DialogService } from '@core/services/dialog.service';
import { AuthService } from '@core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  inputNodeComponent,
  ResolvedRuleChainMetaData,
  RuleChain,
  ruleChainNodeComponent
} from '@shared/models/rule-chain.models';
import { FlowchartConstants, NgxFlowchartComponent, UserCallbacks } from 'ngx-flowchart/dist/ngx-flowchart';
import {
  getRuleNodeHelpLink,
  LinkLabel,
  RuleNodeComponentDescriptor,
  RuleNodeType,
  ruleNodeTypeDescriptors,
  ruleNodeTypesLibrary
} from '@shared/models/rule-node.models';
import { FcRuleEdge, FcRuleNode, FcRuleNodeModel, FcRuleNodeType, FcRuleNodeTypeModel } from './rulechain-page.models';
import { RuleChainService } from '@core/http/rule-chain.service';
import { fromEvent, never, of, throwError, NEVER, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, tap, mergeMap } from 'rxjs/operators';
import { ISearchableComponent } from '../../models/searchable-component.models';
import { deepClone, isDefined, isString } from '@core/utils';
import { RuleNodeDetailsComponent } from '@home/pages/rulechain/rule-node-details.component';
import { RuleNodeLinkComponent } from './rule-node-link.component';
import Timeout = NodeJS.Timeout;
import { Dashboard } from '@shared/models/dashboard.models';
import { IAliasController } from '@core/api/widget-api.models';
import { Widget, widgetTypesData } from '@shared/models/widget.models';
import { WidgetConfigComponentData, WidgetInfo } from '@home/models/widget-component.models';
import { DialogComponent } from '@shared/components/dialog.component';
import { UtilsService } from '@core/services/utils.service';
import { EntityService } from '@core/http/entity.service';
import { AddWidgetDialogComponent, AddWidgetDialogData } from '@home/pages/dashboard/add-widget-dialog.component';
import { RuleNodeConfigComponent } from '@home/pages/rulechain/rule-node-config.component';

@Component({
  selector: 'tb-rulechain-page',
  templateUrl: './rulechain-page.component.html',
  styleUrls: ['./rulechain-page.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class RuleChainPageComponent extends PageComponent
  implements AfterViewInit, OnInit, HasDirtyFlag, ISearchableComponent {

  get isDirty(): boolean {
    return this.isDirtyValue || this.isImport;
  }

  @HostBinding('style.width') width = '100%';
  @HostBinding('style.height') height = '100%';

  @ViewChild('ruleNodeSearchInput', {static: false}) ruleNodeSearchInputField: ElementRef;

  @ViewChild('ruleChainCanvas', {static: true}) ruleChainCanvas: NgxFlowchartComponent;

  @ViewChildren('ruleNodeTypeExpansionPanels',
    {read: MatExpansionPanel}) expansionPanels: QueryList<MatExpansionPanel>;

  ruleNodeTypeDescriptorsMap = ruleNodeTypeDescriptors;
  ruleNodeTypesLibraryArray = ruleNodeTypesLibrary;

  isImport: boolean;
  isDirtyValue: boolean;
  isInvalid = false;

  errorTooltips: {[nodeId: string]: JQueryTooltipster.ITooltipsterInstance} = {};
  isFullscreen = false;

  selectedRuleNodeTabIndex = 0;
  editingRuleNode: FcRuleNode = null;
  isEditingRuleNode = false;
  editingRuleNodeIndex = -1;
  editingRuleNodeAllowCustomLabels = false;
  editingRuleNodeLinkLabels: {[label: string]: LinkLabel};

  @ViewChild('tbRuleNode', {static: false}) ruleNodeComponent: RuleNodeDetailsComponent;
  @ViewChild('tbRuleNodeLink', {static: false}) ruleNodeLinkComponent: RuleNodeLinkComponent;

  editingRuleNodeLink: FcRuleEdge = null;
  isEditingRuleNodeLink = false;
  editingRuleNodeLinkIndex = -1;

  isLibraryOpen = true;

  ruleNodeSearch = '';
  ruleNodeTypeSearch = '';

  ruleChain: RuleChain;
  ruleChainMetaData: ResolvedRuleChainMetaData;

  ruleChainModel: FcRuleNodeModel = {
    nodes: [],
    edges: []
  };
  selectedObjects = [];

  editCallbacks: UserCallbacks = {
    edgeDoubleClick: (event, edge) => {
      this.openLinkDetails(edge);
    },
    edgeEdit: (event, edge) => {
      this.openLinkDetails(edge);
    },
    nodeCallbacks: {
      doubleClick: (event, node: FcRuleNode) => {
        this.openNodeDetails(node);
      },
      nodeEdit: (event, node: FcRuleNode) => {
        this.openNodeDetails(node);
      },
      mouseEnter: this.displayNodeDescriptionTooltip.bind(this),
      mouseLeave: this.destroyTooltips.bind(this),
      mouseDown: this.destroyTooltips.bind(this)
    },
    isValidEdge: (source, destination) => {
      return source.type === FlowchartConstants.rightConnectorType && destination.type === FlowchartConstants.leftConnectorType;
    },
    createEdge: (event, edge: FcRuleEdge) => {
      const sourceNode = this.ruleChainCanvas.modelService.nodes.getNodeByConnectorId(edge.source) as FcRuleNode;
      if (sourceNode.component.type === RuleNodeType.INPUT) {
        const destNode = this.ruleChainCanvas.modelService.nodes.getNodeByConnectorId(edge.destination) as FcRuleNode;
        if (destNode.component.type === RuleNodeType.RULE_CHAIN) {
          return NEVER;
        } else {
          const found = this.ruleChainModel.edges.find(theEdge => theEdge.source === (this.inputConnectorId + ''));
          if (found) {
            this.ruleChainCanvas.modelService.edges.delete(found);
          }
          return of(edge);
        }
      } else {
        if (edge.label) {
          if (!edge.labels) {
            edge.labels = edge.label.split(' / ');
          }
          return of(edge);
        } else {
          const labels = this.ruleChainService.getRuleNodeSupportedLinks(sourceNode.component);
          const allowCustomLabels = this.ruleChainService.ruleNodeAllowCustomLinks(sourceNode.component);
          return this.addRuleNodeLink(edge, labels, allowCustomLabels).pipe(
            mergeMap((res) => {
              if (res) {
                return of(res);
              } else {
                return NEVER;
              }
            })
          );
        }
      }
    },
    dropNode: (event, node: FcRuleNode) => {
      this.addRuleNode(node);
    }
  };

  nextNodeID: number;
  nextConnectorID: number;
  inputConnectorId: number;

  ruleNodeTypesModel: {[type: string]: {model: FcRuleNodeTypeModel, selectedObjects: any[]}} = {};

  nodeLibCallbacks: UserCallbacks = {
    nodeCallbacks: {
      mouseEnter: this.displayLibNodeDescriptionTooltip.bind(this),
      mouseLeave: this.destroyTooltips.bind(this),
      mouseDown: this.destroyTooltips.bind(this)
    }
  };

  ruleNodeComponents: Array<RuleNodeComponentDescriptor>;

  flowchartConstants = FlowchartConstants;

  private tooltipTimeout: Timeout;

  constructor(protected store: Store<AppState>,
              private route: ActivatedRoute,
              private router: Router,
              private ruleChainService: RuleChainService,
              private authService: AuthService,
              private translate: TranslateService,
              public dialog: MatDialog,
              public dialogService: DialogService,
              public fb: FormBuilder) {
    super(store);
    this.init();
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    fromEvent(this.ruleNodeSearchInputField.nativeElement, 'keyup')
      .pipe(
        debounceTime(150),
        distinctUntilChanged(),
        tap(() => {
          this.updateRuleChainLibrary();
        })
      )
      .subscribe();
  }

  onSearchTextUpdated(searchText: string) {
    this.ruleNodeSearch = searchText;
    this.updateRuleNodesHighlight();
  }

  private init() {
    this.ruleChain = this.route.snapshot.data.ruleChain;
    if (this.route.snapshot.data.import && !this.ruleChain) {
      this.router.navigateByUrl('ruleChains');
      return;
    }
    this.isImport = this.route.snapshot.data.import;
    this.ruleChainMetaData = this.route.snapshot.data.ruleChainMetaData;
    this.ruleNodeComponents = this.route.snapshot.data.ruleNodeComponents;
    for (const type of ruleNodeTypesLibrary) {
      const desc = ruleNodeTypeDescriptors.get(type);
      if (!desc.special) {
        this.ruleNodeTypesModel[type] = {
          model: {
            nodes: [],
            edges: []
          },
          selectedObjects: []
        };
      }
    }
    this.updateRuleChainLibrary();
    this.createRuleChainModel();
  }

  updateRuleChainLibrary() {
    const search = this.ruleNodeTypeSearch.toUpperCase();
    const res = this.ruleNodeComponents.filter(
      (ruleNodeComponent) => ruleNodeComponent.name.toUpperCase().includes(search));
    this.loadRuleChainLibrary(res);
  }

  private loadRuleChainLibrary(ruleNodeComponents: Array<RuleNodeComponentDescriptor>) {
    for (const componentType of Object.keys(this.ruleNodeTypesModel)) {
      this.ruleNodeTypesModel[componentType].model.nodes.length = 0;
    }
    ruleNodeComponents.forEach((ruleNodeComponent) => {
      const componentType = ruleNodeComponent.type;
      const model = this.ruleNodeTypesModel[componentType].model;
      const desc = ruleNodeTypeDescriptors.get(RuleNodeType[componentType]);
      let icon = desc.icon;
      let iconUrl = null;
      if (ruleNodeComponent.configurationDescriptor.nodeDefinition.icon) {
        icon = ruleNodeComponent.configurationDescriptor.nodeDefinition.icon;
      }
      if (ruleNodeComponent.configurationDescriptor.nodeDefinition.iconUrl) {
        iconUrl = ruleNodeComponent.configurationDescriptor.nodeDefinition.iconUrl;
      }
      const node: FcRuleNodeType = {
        id: 'node-lib-' + componentType + '-' + model.nodes.length,
        component: ruleNodeComponent,
        name: '',
        nodeClass: desc.nodeClass,
        icon,
        iconUrl,
        x: 30,
        y: 10 + 50 * model.nodes.length,
        connectors: []
      };
      if (ruleNodeComponent.configurationDescriptor.nodeDefinition.inEnabled) {
        node.connectors.push(
          {
            type: FlowchartConstants.leftConnectorType,
            id: (model.nodes.length * 2) + ''
          }
        );
      }
      if (ruleNodeComponent.configurationDescriptor.nodeDefinition.outEnabled) {
        node.connectors.push(
          {
            type: FlowchartConstants.rightConnectorType,
            id: (model.nodes.length * 2 + 1) + ''
          }
        );
      }
      model.nodes.push(node);
    });
    if (this.expansionPanels) {
      for (let i = 0; i < ruleNodeTypesLibrary.length; i++) {
        const panel = this.expansionPanels.find((item, index) => {
          return index === i;
        });
        if (panel) {
          const type = ruleNodeTypesLibrary[i];
          if (!this.ruleNodeTypesModel[type].model.nodes.length) {
            panel.close();
          } else {
            panel.open();
          }
        }
      }
    }
  }

  private createRuleChainModel() {
    this.nextNodeID = 1;
    this.nextConnectorID = 1;

    this.selectedObjects.length = 0;
    this.ruleChainModel.nodes.length = 0;
    this.ruleChainModel.edges.length = 0;

    this.inputConnectorId = this.nextConnectorID++;
    this.ruleChainModel.nodes.push(
      {
        id: 'rule-chain-node-' + this.nextNodeID++,
        component: inputNodeComponent,
        name: '',
        nodeClass: ruleNodeTypeDescriptors.get(RuleNodeType.INPUT).nodeClass,
        icon: ruleNodeTypeDescriptors.get(RuleNodeType.INPUT).icon,
        readonly: true,
        x: 50,
        y: 150,
        connectors: [
          {
            type: FlowchartConstants.rightConnectorType,
            id: this.inputConnectorId + ''
          },
        ]

      }
    );
    const nodes: FcRuleNode[] = [];
    this.ruleChainMetaData.nodes.forEach((ruleNode) => {
      const component = this.ruleChainService.getRuleNodeComponentByClazz(ruleNode.type);
      const descriptor = ruleNodeTypeDescriptors.get(component.type);
      let icon = descriptor.icon;
      let iconUrl = null;
      if (component.configurationDescriptor.nodeDefinition.icon) {
        icon = component.configurationDescriptor.nodeDefinition.icon;
      }
      if (component.configurationDescriptor.nodeDefinition.iconUrl) {
        iconUrl = component.configurationDescriptor.nodeDefinition.iconUrl;
      }
      const node: FcRuleNode = {
        id: 'rule-chain-node-' + this.nextNodeID++,
        ruleNodeId: ruleNode.id,
        additionalInfo: ruleNode.additionalInfo,
        configuration: ruleNode.configuration,
        debugMode: ruleNode.debugMode,
        x: Math.round(ruleNode.additionalInfo.layoutX),
        y: Math.round(ruleNode.additionalInfo.layoutY),
        component,
        name: ruleNode.name,
        nodeClass: descriptor.nodeClass,
        icon,
        iconUrl,
        connectors: []
      };
      if (component.configurationDescriptor.nodeDefinition.inEnabled) {
        node.connectors.push(
          {
            type: FlowchartConstants.leftConnectorType,
            id: (this.nextConnectorID++) + ''
          }
        );
      }
      if (component.configurationDescriptor.nodeDefinition.outEnabled) {
        node.connectors.push(
          {
            type: FlowchartConstants.rightConnectorType,
            id: (this.nextConnectorID++) + ''
          }
        );
      }
      nodes.push(node);
      this.ruleChainModel.nodes.push(node);
    });
    if (this.ruleChainMetaData.firstNodeIndex > -1) {
      const destNode = nodes[this.ruleChainMetaData.firstNodeIndex];
      if (destNode) {
        const connectors = destNode.connectors.filter(connector => connector.type === FlowchartConstants.leftConnectorType);
        if (connectors && connectors.length) {
          const edge: FcRuleEdge = {
            source: this.inputConnectorId + '',
            destination: connectors[0].id
          };
          this.ruleChainModel.edges.push(edge);
        }
      }
    }
    if (this.ruleChainMetaData.connections) {
      const edgeMap: {[edgeKey: string]: FcRuleEdge} = {};
      this.ruleChainMetaData.connections.forEach((connection) => {
        const sourceNode = nodes[connection.fromIndex];
        const destNode = nodes[connection.toIndex];
        if (sourceNode && destNode) {
          const sourceConnectors = sourceNode.connectors.filter(connector => connector.type === FlowchartConstants.rightConnectorType);
          const destConnectors = destNode.connectors.filter(connector => connector.type === FlowchartConstants.leftConnectorType);
          if (sourceConnectors && sourceConnectors.length && destConnectors && destConnectors.length) {
            const sourceId = sourceConnectors[0].id;
            const destId = destConnectors[0].id;
            const edgeKey = sourceId + '_' + destId;
            let edge = edgeMap[edgeKey];
            if (!edge) {
              edge = {
                source: sourceId,
                destination: destId,
                label: connection.type,
                labels: [connection.type]
              };
              edgeMap[edgeKey] = edge;
              this.ruleChainModel.edges.push(edge);
            } else {
              edge.label += ' / ' + connection.type;
              edge.labels.push(connection.type);
            }
          }
        }
      });
    }
    if (this.ruleChainMetaData.ruleChainConnections) {
      const ruleChainsMap = this.ruleChainMetaData.targetRuleChainsMap;
      const ruleChainNodesMap: {[ruleChainNodeId: string]: FcRuleNode} = {};
      const ruleChainEdgeMap: {[edgeKey: string]: FcRuleEdge} = {};
      this.ruleChainMetaData.ruleChainConnections.forEach((ruleChainConnection) => {
        const ruleChain = ruleChainsMap[ruleChainConnection.targetRuleChainId.id];
        if (ruleChainConnection.additionalInfo && ruleChainConnection.additionalInfo.ruleChainNodeId) {
          let ruleChainNode = ruleChainNodesMap[ruleChainConnection.additionalInfo.ruleChainNodeId];
          if (!ruleChainNode) {
            ruleChainNode = {
              id: 'rule-chain-node-' + this.nextNodeID++,
              name: ruleChain.name ? name : 'Unresolved',
              targetRuleChainId: ruleChain.name ? ruleChainConnection.targetRuleChainId.id : null,
              error: ruleChain.name ? undefined : this.translate.instant('rulenode.invalid-target-rulechain'),
              additionalInfo: ruleChainConnection.additionalInfo,
              x: Math.round(ruleChainConnection.additionalInfo.layoutX),
              y: Math.round(ruleChainConnection.additionalInfo.layoutY),
              component: ruleChainNodeComponent,
              nodeClass: ruleNodeTypeDescriptors.get(RuleNodeType.RULE_CHAIN).nodeClass,
              icon: ruleNodeTypeDescriptors.get(RuleNodeType.RULE_CHAIN).icon,
              connectors: [
                {
                  type: FlowchartConstants.leftConnectorType,
                  id: (this.nextConnectorID++) + ''
                }
              ]
            };
            ruleChainNodesMap[ruleChainConnection.additionalInfo.ruleChainNodeId] = ruleChainNode;
            this.ruleChainModel.nodes.push(ruleChainNode);
          }
          const sourceNode = nodes[ruleChainConnection.fromIndex];
          if (sourceNode) {
            const connectors = sourceNode.connectors.filter(connector => connector.type === FlowchartConstants.rightConnectorType);
            if (connectors && connectors.length) {
              const sourceId = connectors[0].id;
              const destId = ruleChainNode.connectors[0].id;
              const edgeKey = sourceId + '_' + destId;
              let ruleChainEdge = ruleChainEdgeMap[edgeKey];
              if (!ruleChainEdge) {
                ruleChainEdge = {
                  source: sourceId,
                  destination: destId,
                  label: ruleChainConnection.type,
                  labels: [ruleChainConnection.type]
                };
                ruleChainEdgeMap[edgeKey] = ruleChainEdge;
                this.ruleChainModel.edges.push(ruleChainEdge);
              } else {
                ruleChainEdge.label += ' / ' + ruleChainConnection.type;
                ruleChainEdge.labels.push(ruleChainConnection.type);
              }
            }
          }
        }
      });
    }
    this.isDirtyValue = false;
    this.updateRuleNodesHighlight();
    this.validate();
  }

  onModelChanged() {
    console.log('Model changed!');
    this.isDirtyValue = true;
    this.validate();
  }

  helpLinkIdForRuleNodeType(): string {
    let component: RuleNodeComponentDescriptor = null;
    if (this.editingRuleNode) {
      component = this.editingRuleNode.component;
    }
    return getRuleNodeHelpLink(component);
  }

  openNodeDetails(node: FcRuleNode) {
    if (node.component.type !== RuleNodeType.INPUT) {
      this.isEditingRuleNodeLink = false;
      this.editingRuleNodeLink = null;
      this.isEditingRuleNode = true;
      this.editingRuleNodeIndex = this.ruleChainModel.nodes.indexOf(node);
      this.editingRuleNode = deepClone(node);
      setTimeout(() => {
        this.ruleNodeComponent.ruleNodeFormGroup.markAsPristine();
      }, 0);
    }
  }

  openLinkDetails(edge: FcRuleEdge) {
    const sourceNode: FcRuleNode = this.ruleChainCanvas.modelService.nodes.getNodeByConnectorId(edge.source) as FcRuleNode;
    if (sourceNode.component.type !== RuleNodeType.INPUT) {
      this.isEditingRuleNode = false;
      this.editingRuleNode = null;
      this.editingRuleNodeLinkLabels = this.ruleChainService.getRuleNodeSupportedLinks(sourceNode.component);
      this.editingRuleNodeAllowCustomLabels = this.ruleChainService.ruleNodeAllowCustomLinks(sourceNode.component);
      this.isEditingRuleNodeLink = true;
      this.editingRuleNodeLinkIndex = this.ruleChainModel.edges.indexOf(edge);
      this.editingRuleNodeLink = deepClone(edge);
      setTimeout(() => {
        this.ruleNodeLinkComponent.ruleNodeLinkFormGroup.markAsPristine();
      }, 0);
    }
  }

  onDetailsDrawerClosed() {
    this.onEditRuleNodeClosed();
    this.onEditRuleNodeLinkClosed();
  }

  onEditRuleNodeClosed() {
    this.editingRuleNode = null;
    this.isEditingRuleNode = false;
  }

  onEditRuleNodeLinkClosed() {
    this.editingRuleNodeLink = null;
    this.isEditingRuleNodeLink = false;
  }

  onRevertRuleNodeEdit() {
    this.ruleNodeComponent.ruleNodeFormGroup.markAsPristine();
    const node = this.ruleChainModel.nodes[this.editingRuleNodeIndex];
    this.editingRuleNode = deepClone(node);
  }

  onRevertRuleNodeLinkEdit() {
    this.ruleNodeLinkComponent.ruleNodeLinkFormGroup.markAsPristine();
    const edge = this.ruleChainModel.edges[this.editingRuleNodeLinkIndex];
    this.editingRuleNodeLink = deepClone(edge);
  }

  saveRuleNode() {
    this.ruleNodeComponent.validate();
    if (this.ruleNodeComponent.ruleNodeFormGroup.valid) {
      this.ruleNodeComponent.ruleNodeFormGroup.markAsPristine();
      if (this.editingRuleNode.error) {
        delete this.editingRuleNode.error;
      }
      this.ruleChainModel.nodes[this.editingRuleNodeIndex] = this.editingRuleNode;
      this.editingRuleNode = deepClone(this.editingRuleNode);
      this.onModelChanged();
      this.updateRuleNodesHighlight();
    }
  }

  saveRuleNodeLink() {
    this.ruleNodeLinkComponent.ruleNodeLinkFormGroup.markAsPristine();
    this.ruleChainModel.edges[this.editingRuleNodeLinkIndex] = this.editingRuleNodeLink;
    this.editingRuleNodeLink = deepClone(this.editingRuleNodeLink);
    this.onModelChanged();
  }

  typeHeaderMouseEnter(event: MouseEvent, ruleNodeType: RuleNodeType) {
    const type = ruleNodeTypeDescriptors.get(ruleNodeType);
    this.displayTooltip(event,
      '<div class="tb-rule-node-tooltip tb-lib-tooltip">' +
      '<div id="tb-node-content" layout="column">' +
      '<div class="tb-node-title">' + this.translate.instant(type.name) + '</div>' +
      '<div class="tb-node-details">' + this.translate.instant(type.details) + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  displayLibNodeDescriptionTooltip(event: MouseEvent, node: FcRuleNodeType) {
    this.displayTooltip(event,
      '<div class="tb-rule-node-tooltip tb-lib-tooltip">' +
      '<div id="tb-node-content" layout="column">' +
      '<div class="tb-node-title">' + node.component.name + '</div>' +
      '<div class="tb-node-description">' + node.component.configurationDescriptor.nodeDefinition.description + '</div>' +
      '<div class="tb-node-details">' + node.component.configurationDescriptor.nodeDefinition.details + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  displayNodeDescriptionTooltip(event: MouseEvent, node: FcRuleNode) {
    if (!this.errorTooltips[node.id]) {
      let name: string;
      let desc: string;
      let details: string;
      if (node.component.type === RuleNodeType.INPUT) {
        name = this.translate.instant(ruleNodeTypeDescriptors.get(RuleNodeType.INPUT).name);
        desc = this.translate.instant(ruleNodeTypeDescriptors.get(RuleNodeType.INPUT).details);
      } else {
        name = node.name;
        desc = this.translate.instant(ruleNodeTypeDescriptors.get(node.component.type).name) + ' - ' + node.component.name;
        if (node.additionalInfo) {
          details = node.additionalInfo.description;
        }
      }
      let tooltipContent = '<div class="tb-rule-node-tooltip">' +
        '<div id="tb-node-content" layout="column">' +
        '<div class="tb-node-title">' + name + '</div>' +
        '<div class="tb-node-description">' + desc + '</div>';
      if (details) {
        tooltipContent += '<div class="tb-node-details">' + details + '</div>';
      }
      tooltipContent += '</div>' +
        '</div>';
      this.displayTooltip(event, tooltipContent);
    }
  }

  destroyTooltips() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    const instances = $.tooltipster.instances();
    instances.forEach((instance) => {
      if (!instance.isErrorTooltip) {
        instance.destroy();
      }
    });
  }

  private updateRuleNodesHighlight() {
    for (const ruleNode of this.ruleChainModel.nodes) {
      ruleNode.highlighted = false;
    }
    if (this.ruleNodeSearch) {
      const search = this.ruleNodeSearch.toUpperCase();
      const res = this.ruleChainModel.nodes.filter(node => node.name.toUpperCase().includes(search));
      if (res) {
        for (const ruleNode of res) {
          ruleNode.highlighted = true;
        }
      }
    }
    if (this.ruleChainCanvas) {
      this.ruleChainCanvas.modelService.detectChanges();
    }
  }

  objectsSelected(): boolean {
    return this.ruleChainCanvas.modelService.nodes.getSelectedNodes().length > 0 ||
      this.ruleChainCanvas.modelService.edges.getSelectedEdges().length > 0;
  }

  deleteSelected() {
    this.ruleChainCanvas.modelService.deleteSelected();
  }

  isDebugModeEnabled(): boolean {
    const res = this.ruleChainModel.nodes.find((node) => node.debugMode);
    return typeof res !== 'undefined';
  }

  resetDebugModeInAllNodes() {
    let changed = false;
    this.ruleChainModel.nodes.forEach((node) => {
      if (node.component.type !== RuleNodeType.INPUT && node.component.type !== RuleNodeType.RULE_CHAIN) {
        changed = changed || node.debugMode;
        node.debugMode = false;
      }
    });
    if (changed) {
      this.onModelChanged();
    }
  }

  validate() {
    setTimeout(() => {
      this.isInvalid = false;
      this.ruleChainModel.nodes.forEach((node) => {
        if (node.error) {
          this.isInvalid = true;
        }
        this.updateNodeErrorTooltip(node);
      });
    }, 0);
  }

  saveRuleChain() {
    // TODO:
  }

  revertRuleChain() {
    this.createRuleChainModel();
  }

  addRuleNode(ruleNode: FcRuleNode) {
    ruleNode.configuration = deepClone(ruleNode.component.configurationDescriptor.nodeDefinition.defaultConfiguration);
    const ruleChainId = this.ruleChain.id ? this.ruleChain.id.id : null;
    this.dialog.open<AddRuleNodeDialogComponent, AddRuleNodeDialogData,
      FcRuleNode>(AddRuleNodeDialogComponent, {
      disableClose: true,
      panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
      data: {
        ruleNode,
        ruleChainId
      }
    }).afterClosed().subscribe(
      (addedRuleNode) => {
        if (addedRuleNode) {
          addedRuleNode.id = 'rule-chain-node-' + this.nextNodeID++;
          addedRuleNode.connectors = [];
          if (addedRuleNode.component.configurationDescriptor.nodeDefinition.inEnabled) {
            addedRuleNode.connectors.push(
              {
                id: (this.nextConnectorID++) + '',
                type: FlowchartConstants.leftConnectorType
              }
            );
          }
          if (addedRuleNode.component.configurationDescriptor.nodeDefinition.outEnabled) {
            addedRuleNode.connectors.push(
              {
                id: (this.nextConnectorID++) + '',
                type: FlowchartConstants.rightConnectorType
              }
            );
          }
          this.ruleChainModel.nodes.push(addedRuleNode);
          this.onModelChanged();
          this.updateRuleNodesHighlight();
        }
      }
    );
  }

  addRuleNodeLink(link: FcRuleEdge, labels: {[label: string]: LinkLabel}, allowCustomLabels: boolean): Observable<FcRuleEdge> {
    return this.dialog.open<AddRuleNodeLinkDialogComponent, AddRuleNodeLinkDialogData,
      FcRuleEdge>(AddRuleNodeLinkDialogComponent, {
      disableClose: true,
      panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
      data: {
        link,
        labels,
        allowCustomLabels
      }
    }).afterClosed();
  }

  private updateNodeErrorTooltip(node: FcRuleNode) {
    if (node.error) {
      const element = $('#' + node.id);
      let tooltip = this.errorTooltips[node.id];
      if (!tooltip || !element.hasClass('tooltipstered')) {
        element.tooltipster(
          {
            theme: 'tooltipster-shadow',
            delay: 0,
            animationDuration: 0,
            trigger: 'custom',
            triggerOpen: {
              click: false,
              tap: false
            },
            triggerClose: {
              click: false,
              tap: false,
              scroll: false
            },
            side: 'top',
            trackOrigin: true
          }
        );
        const content = '<div class="tb-rule-node-error-tooltip">' +
          '<div id="tooltip-content" layout="column">' +
          '<div class="tb-node-details">' + node.error + '</div>' +
          '</div>' +
          '</div>';
        const contentElement = $(content);
        tooltip = element.tooltipster('instance');
        tooltip.isErrorTooltip = true;
        tooltip.content(contentElement);
        this.errorTooltips[node.id] = tooltip;
      }
      setTimeout(() => {
        tooltip.open();
      }, 0);
    } else {
      if (this.errorTooltips[node.id]) {
        const tooltip = this.errorTooltips[node.id];
        tooltip.destroy();
        delete this.errorTooltips[node.id];
      }
    }
  }

  private displayTooltip(event: MouseEvent, content: string) {
    this.destroyTooltips();
    this.tooltipTimeout = setTimeout(() => {
      const element = $(event.target);
      element.tooltipster(
        {
          theme: 'tooltipster-shadow',
          delay: 100,
          trigger: 'custom',
          triggerOpen: {
            click: false,
            tap: false
          },
          triggerClose: {
            click: true,
            tap: true,
            scroll: true
          },
          side: 'right',
          trackOrigin: true
        }
      );
      const contentElement = $(content);
      const tooltip = element.tooltipster('instance');
      tooltip.content(contentElement);
      tooltip.open();
    }, 500);
  }
}

export interface AddRuleNodeLinkDialogData {
  link: FcRuleEdge;
  labels: {[label: string]: LinkLabel};
  allowCustomLabels: boolean;
}

@Component({
  selector: 'tb-add-rule-node-link-dialog',
  templateUrl: './add-rule-node-link-dialog.component.html',
  providers: [{provide: ErrorStateMatcher, useExisting: AddRuleNodeLinkDialogComponent}],
  styleUrls: ['./add-rule-node-link-dialog.component.scss']
})
export class AddRuleNodeLinkDialogComponent extends DialogComponent<AddRuleNodeLinkDialogComponent, FcRuleEdge>
  implements OnInit, ErrorStateMatcher {

  ruleNodeLinkFormGroup: FormGroup;

  link: FcRuleEdge;
  labels: {[label: string]: LinkLabel};
  allowCustomLabels: boolean;

  submitted = false;

  constructor(protected store: Store<AppState>,
              protected router: Router,
              @Inject(MAT_DIALOG_DATA) public data: AddRuleNodeLinkDialogData,
              @SkipSelf() private errorStateMatcher: ErrorStateMatcher,
              public dialogRef: MatDialogRef<AddRuleNodeLinkDialogComponent, FcRuleEdge>,
              private fb: FormBuilder) {
    super(store, router, dialogRef);

    this.link = this.data.link;
    this.labels = this.data.labels;
    this.allowCustomLabels = this.data.allowCustomLabels;

    this.ruleNodeLinkFormGroup = this.fb.group({
        link: [deepClone(this.link), [Validators.required]]
      }
    );
  }

  ngOnInit(): void {
  }

  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const originalErrorState = this.errorStateMatcher.isErrorState(control, form);
    const customErrorState = !!(control && control.invalid && this.submitted);
    return originalErrorState || customErrorState;
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    this.submitted = true;
    const link: FcRuleEdge = this.ruleNodeLinkFormGroup.get('link').value;
    this.link = {...this.link, ...link};
    this.dialogRef.close(this.link);
  }
}

export interface AddRuleNodeDialogData {
  ruleNode: FcRuleNode;
  ruleChainId: string;
}

@Component({
  selector: 'tb-add-rule-node-dialog',
  templateUrl: './add-rule-node-dialog.component.html',
  providers: [{provide: ErrorStateMatcher, useExisting: AddRuleNodeDialogComponent}],
  styleUrls: []
})
export class AddRuleNodeDialogComponent extends DialogComponent<AddRuleNodeDialogComponent, FcRuleNode>
  implements OnInit, ErrorStateMatcher {

  @ViewChild('tbRuleNode', {static: true}) ruleNodeDetailsComponent: RuleNodeDetailsComponent;

  ruleNode: FcRuleNode;
  ruleChainId: string;

  submitted = false;

  constructor(protected store: Store<AppState>,
              protected router: Router,
              @Inject(MAT_DIALOG_DATA) public data: AddRuleNodeDialogData,
              @SkipSelf() private errorStateMatcher: ErrorStateMatcher,
              public dialogRef: MatDialogRef<AddRuleNodeDialogComponent, FcRuleNode>) {
    super(store, router, dialogRef);

    this.ruleNode = this.data.ruleNode;
    this.ruleChainId = this.data.ruleChainId;
  }

  ngOnInit(): void {
  }

  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const originalErrorState = this.errorStateMatcher.isErrorState(control, form);
    const customErrorState = !!(control && control.invalid && this.submitted);
    return originalErrorState || customErrorState;
  }

  helpLinkIdForRuleNodeType(): string {
    return getRuleNodeHelpLink(this.ruleNode.component);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    this.submitted = true;
    this.ruleNodeDetailsComponent.validate();
    if (this.ruleNodeDetailsComponent.ruleNodeFormGroup.valid) {
      this.dialogRef.close(this.ruleNode);
    }
  }
}
