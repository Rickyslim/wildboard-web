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

import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { PageComponent } from '@shared/components/page.component';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import {
  DataKey,
  Datasource,
  DatasourceType, datasourceTypeTranslationMap,
  LegendConfig,
  WidgetActionDescriptor,
  WidgetActionSource,
  WidgetConfigSettings,
  widgetType,
  WidgetTypeParameters
} from '@shared/models/widget.models';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  Validator,
  Validators
} from '@angular/forms';
import { WidgetConfigComponentData } from '@home/models/widget-component.models';
import { deepClone, isDefined, isObject } from '@app/core/utils';
import { alarmFields, AlarmSearchStatus } from '@shared/models/alarm.models';
import { IAliasController } from '@core/api/widget-api.models';
import { EntityAlias, EntityAliases } from '@shared/models/alias.models';
import { UtilsService } from '@core/services/utils.service';
import { DataKeyType } from '@shared/models/telemetry/telemetry.models';
import { TranslateService } from '@ngx-translate/core';
import { EntityType } from '@shared/models/entity-type.models';
import { Observable, of, Subscription } from 'rxjs';
import { WidgetConfigCallbacks } from '@home/components/widget/widget-config.component.models';
import {
  EntityAliasDialogComponent,
  EntityAliasDialogData
} from '@home/components/alias/entity-alias-dialog.component';
import { tap } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'tb-widget-config',
  templateUrl: './widget-config.component.html',
  styleUrls: ['./widget-config.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WidgetConfigComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => WidgetConfigComponent),
      multi: true,
    }
  ]
})
export class WidgetConfigComponent extends PageComponent implements OnInit, ControlValueAccessor, Validator {

  widgetTypes = widgetType;

  entityTypes = EntityType;

  alarmSearchStatuses = Object.keys(AlarmSearchStatus);

  @Input()
  forceExpandDatasources: boolean;

  @Input()
  isDataEnabled: boolean;

  @Input()
  typeParameters: WidgetTypeParameters;

  @Input()
  actionSources: {[key: string]: WidgetActionSource};

  @Input()
  aliasController: IAliasController;

  @Input()
  entityAliases: EntityAliases;

  @Input()
  widgetSettingsSchema: any;

  @Input()
  dataKeySettingsSchema: any;

  @Input()
  functionsOnly: boolean;

  @Input() disabled: boolean;

  widgetType: widgetType;

  datasourceType = DatasourceType;
  datasourceTypes: Array<DatasourceType>;
  datasourceTypesTranslations = datasourceTypeTranslationMap;

  widgetConfigCallbacks: WidgetConfigCallbacks = {
    createEntityAlias: this.createEntityAlias.bind(this),
    generateDataKey: this.generateDataKey.bind(this)
  };

  widgetEditMode = this.utils.widgetEditMode;

  selectedTab: number;
  title: string;
  showTitleIcon: boolean;
  titleIcon: string;
  iconColor: string;
  iconSize: string;
  showTitle: boolean;
  dropShadow: boolean;
  enableFullscreen: boolean;
  backgroundColor: string;
  color: string;
  padding: string;
  margin: string;
  widgetStyle: string;
  titleStyle: string;
  units: string;
  decimals: number;
  showLegend: boolean;
  legendConfig: LegendConfig;
  actions: {[actionSourceId: string]: Array<WidgetActionDescriptor>};
  alarmSource: Datasource;
  settings: WidgetConfigSettings;
  mobileOrder: number;
  mobileHeight: number;

  emptySettingsSchema = {
    type: 'object',
    properties: {}
  };

  emptySettingsGroupInfoes = [];

  defaultSettingsForm = [
    '*'
  ];

  currentSettingsSchema = deepClone(this.emptySettingsSchema);

  currentSettings: WidgetConfigSettings = {};
  currentSettingsGroupInfoes = deepClone(this.emptySettingsGroupInfoes);

  currentSettingsForm: any;

  private modelValue: WidgetConfigComponentData;

  private propagateChange = null;

  public dataSettings: FormGroup;
  public targetDeviceSettings: FormGroup;

  private dataSettingsChangesSubscription: Subscription;
  private targetDeviceSettingsSubscription: Subscription;

  constructor(protected store: Store<AppState>,
              private utils: UtilsService,
              private dialog: MatDialog,
              private translate: TranslateService,
              private fb: FormBuilder) {
    super(store);
  }

  ngOnInit(): void {
    if (this.functionsOnly) {
      this.datasourceTypes = [DatasourceType.function];
    } else {
      this.datasourceTypes = [DatasourceType.function, DatasourceType.entity];
    }
  }

  private removeChangeSubscriptions() {
    if (this.dataSettingsChangesSubscription) {
      this.dataSettingsChangesSubscription.unsubscribe();
      this.dataSettingsChangesSubscription = null;
    }
    if (this.targetDeviceSettingsSubscription) {
      this.targetDeviceSettingsSubscription.unsubscribe();
      this.targetDeviceSettingsSubscription = null;
    }
  }

  private createChangeSubscriptions() {
    this.dataSettingsChangesSubscription = this.dataSettings.valueChanges.subscribe(
      () => this.updateDataSettings()
    );
    this.targetDeviceSettingsSubscription = this.targetDeviceSettings.valueChanges.subscribe(
      () => this.updateTargetDeviceSettings()
    );
  }

  private buildForms() {
    this.dataSettings = this.fb.group({});
    this.targetDeviceSettings = this.fb.group({});
    if (this.widgetType === widgetType.timeseries || this.widgetType === widgetType.alarm) {
      this.dataSettings.addControl('useDashboardTimewindow', this.fb.control(null));
      this.dataSettings.addControl('displayTimewindow', this.fb.control(null));
      this.dataSettings.addControl('timewindow', this.fb.control(null));
      this.dataSettings.get('useDashboardTimewindow').valueChanges.subscribe((value: boolean) => {
        if (value) {
          this.dataSettings.get('displayTimewindow').disable({emitEvent: false});
          this.dataSettings.get('timewindow').disable({emitEvent: false});
        } else {
          this.dataSettings.get('displayTimewindow').enable({emitEvent: false});
          this.dataSettings.get('timewindow').enable({emitEvent: false});
        }
      });
      if (this.widgetType === widgetType.alarm) {
        this.dataSettings.addControl('alarmSearchStatus', this.fb.control(null));
        this.dataSettings.addControl('alarmsPollingInterval', this.fb.control(null,
          [Validators.required, Validators.min(1)]));
      }
    }
    if (this.isDataEnabled) {
      if (this.widgetType !== widgetType.rpc &&
        this.widgetType !== widgetType.alarm &&
        this.widgetType !== widgetType.static) {
        this.dataSettings.addControl('datasources',
          this.fb.array([]));
      } else if (this.widgetType === widgetType.rpc) {
        this.targetDeviceSettings.addControl('targetDeviceAliasId',
          this.fb.control(null,
            this.widgetEditMode ? [] : [Validators.required]));
      }
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  writeValue(value: WidgetConfigComponentData): void {
    this.modelValue = value;
    this.removeChangeSubscriptions();
    if (this.modelValue) {
      if (this.widgetType !== this.modelValue.widgetType) {
        this.widgetType = this.modelValue.widgetType;
        this.buildForms();
      }
      const config = this.modelValue.config;
      const layout = this.modelValue.layout;
      if (config) {
        this.selectedTab = 0;
        this.title = config.title;
        this.showTitleIcon = isDefined(config.showTitleIcon) ? config.showTitleIcon : false;
        this.titleIcon = isDefined(config.titleIcon) ? config.titleIcon : '';
        this.iconColor = isDefined(config.iconColor) ? config.iconColor : 'rgba(0, 0, 0, 0.87)';
        this.iconSize = isDefined(config.iconSize) ? config.iconSize : '24px';
        this.showTitle = config.showTitle;
        this.dropShadow = isDefined(config.dropShadow) ? config.dropShadow : true;
        this.enableFullscreen = isDefined(config.enableFullscreen) ? config.enableFullscreen : true;
        this.backgroundColor = config.backgroundColor;
        this.color = config.color;
        this.padding = config.padding;
        this.margin = config.margin;
        this.widgetStyle =
          JSON.stringify(isDefined(config.widgetStyle) ? config.widgetStyle : {}, null, 2);
        this.titleStyle =
          JSON.stringify(isDefined(config.titleStyle) ? config.titleStyle : {
            fontSize: '16px',
            fontWeight: 400
          }, null, 2);
        this.units = config.units;
        this.decimals = config.decimals;
        this.actions = config.actions;
        if (!this.actions) {
          this.actions = {};
        }
        if (this.widgetType === widgetType.timeseries || this.widgetType === widgetType.alarm) {
          const useDashboardTimewindow = isDefined(config.useDashboardTimewindow) ?
            config.useDashboardTimewindow : true;
          this.dataSettings.patchValue(
            { useDashboardTimewindow }, {emitEvent: false}
          );
          if (useDashboardTimewindow) {
            this.dataSettings.get('displayTimewindow').disable({emitEvent: false});
            this.dataSettings.get('timewindow').disable({emitEvent: false});
          } else {
            this.dataSettings.get('displayTimewindow').enable({emitEvent: false});
            this.dataSettings.get('timewindow').enable({emitEvent: false});
          }
          this.dataSettings.patchValue(
            { displayTimewindow: isDefined(config.displayTimewindow) ?
                config.displayTimewindow : true }, {emitEvent: false}
          );
          this.dataSettings.patchValue(
            { timewindow: config.timewindow }, {emitEvent: false}
          );
        }
        if (this.isDataEnabled) {
          if (this.widgetType !== widgetType.rpc &&
            this.widgetType !== widgetType.alarm &&
            this.widgetType !== widgetType.static) {
            const datasourcesFormArray = this.dataSettings.get('datasources') as FormArray;
            datasourcesFormArray.clear();
            if (config.datasources) {
              config.datasources.forEach((datasource) => {
                datasourcesFormArray.push(this.buildDatasourceForm(datasource));
              });
            }
          } else if (this.widgetType === widgetType.rpc) {
            let targetDeviceAliasId: string;
            if (config.targetDeviceAliasIds && config.targetDeviceAliasIds.length > 0) {
              const aliasId = config.targetDeviceAliasIds[0];
              const entityAliases = this.aliasController.getEntityAliases();
              if (entityAliases[aliasId]) {
                targetDeviceAliasId = entityAliases[aliasId].id;
              } else {
                targetDeviceAliasId = null;
              }
            } else {
              targetDeviceAliasId = null;
            }
            this.targetDeviceSettings.patchValue({
              targetDeviceAliasId
            }, {emitEvent: false});
          } else if (this.widgetType === widgetType.alarm) {
            this.dataSettings.patchValue(
              { alarmSearchStatus: isDefined(config.alarmSearchStatus) ?
                  config.alarmSearchStatus : AlarmSearchStatus.ANY }, {emitEvent: false}
            );
            this.dataSettings.patchValue(
              { alarmsPollingInterval: isDefined(config.alarmsPollingInterval) ?
                  config.alarmsPollingInterval : 5}, {emitEvent: false}
            );
            if (config.alarmSource) {
              this.alarmSource = config.alarmSource;
            } else {
              this.alarmSource = null;
            }
          }
        }
        this.settings = config.settings;

        this.updateSchemaForm();

        if (layout) {
          this.mobileOrder = layout.mobileOrder;
          this.mobileHeight = layout.mobileHeight;
        } else {
          this.mobileOrder = undefined;
          this.mobileHeight = undefined;
        }
      }
      this.createChangeSubscriptions();
    }
  }

  private buildDatasourceForm(datasource?: Datasource): AbstractControl {
    const datasourceFormGroup = this.fb.group(
      {
        type: [datasource ? datasource.type : null, [Validators.required]],
        name: [datasource ? datasource.name : null, []],
        entityAliasId: [datasource ? datasource.entityAliasId : null,
          datasource && datasource.type === DatasourceType.entity ? [Validators.required] : []],
        dataKeys: [datasource ? datasource.name : null, []]
      }
    );
    datasourceFormGroup.get('type').valueChanges.subscribe((type: DatasourceType) => {
      let dataKeys;
      if (this.widgetType === widgetType.alarm) {
        dataKeys = this.utils.getDefaultAlarmDataKeys();
      } else {
        dataKeys = [];
      }
      datasourceFormGroup.patchValue({
        dataKeys
      });
      datasourceFormGroup.get('entityAliasId').setValidators(
        type === DatasourceType.entity ? [Validators.required] : []
      );
      datasourceFormGroup.get('entityAliasId').updateValueAndValidity();
    });
    return datasourceFormGroup;
  }

  private updateSchemaForm() {
    if (this.widgetSettingsSchema && this.widgetSettingsSchema.schema) {
      this.currentSettingsSchema = this.widgetSettingsSchema.schema;
      this.currentSettingsForm = this.widgetSettingsSchema.form || deepClone(this.defaultSettingsForm);
      this.currentSettingsGroupInfoes = this.widgetSettingsSchema.groupInfoes;
      this.currentSettings = this.settings;
    } else {
      this.currentSettingsForm = deepClone(this.defaultSettingsForm);
      this.currentSettingsSchema = deepClone(this.emptySettingsSchema);
      this.currentSettingsGroupInfoes = deepClone(this.emptySettingsGroupInfoes);
      this.currentSettings = {};
    }
  }

  private updateDataSettings() {
    if (this.modelValue) {
      if (this.modelValue.config) {
        Object.assign(this.modelValue.config, this.dataSettings.value);
      }
      this.propagateChange(this.modelValue);
    }
  }

  private updateTargetDeviceSettings() {
    if (this.modelValue) {
      if (this.modelValue.config) {
        const targetDeviceAliasId: string = this.targetDeviceSettings.get('targetDeviceAliasId').value;
        if (targetDeviceAliasId) {
          this.modelValue.config.targetDeviceAliasIds = [targetDeviceAliasId];
        } else {
          this.modelValue.config.targetDeviceAliasIds = [];
        }
      }
      this.propagateChange(this.modelValue);
    }
  }

  public displayAdvanced(): boolean {
    return this.widgetSettingsSchema && this.widgetSettingsSchema.schema;
  }

  public removeDatasource(index: number) {
    (this.dataSettings.get('datasources') as FormArray).removeAt(index);
  }

  public addDatasource() {
    let newDatasource: Datasource;
    if (this.functionsOnly) {
      newDatasource = deepClone(this.utils.getDefaultDatasource(this.dataKeySettingsSchema.schema));
      newDatasource.dataKeys = [this.generateDataKey('Sin', DataKeyType.function)];
    } else {
      newDatasource = { type: DatasourceType.entity,
        dataKeys: []
      };
    }
    const datasourcesFormArray = this.dataSettings.get('datasources') as FormArray;
    datasourcesFormArray.push(this.buildDatasourceForm(newDatasource));
  }

  public generateDataKey(chip: any, type: DataKeyType): DataKey {
    if (isObject(chip)) {
      (chip as DataKey)._hash = Math.random();
      return chip;
    } else {
      let label: string = chip;
      if (type === DataKeyType.alarm) {
        const alarmField = alarmFields[label];
        if (alarmField) {
          label = this.translate.instant(alarmField.name);
        }
      }
      label = this.genNextLabel(label);
      const result: DataKey = {
        name: chip,
        type,
        label,
        color: this.genNextColor(),
        settings: {},
        _hash: Math.random()
      };
      if (type === DataKeyType.function) {
        result.name = 'f(x)';
        result.funcBody = this.utils.getPredefinedFunctionBody(chip);
        if (!result.funcBody) {
          result.funcBody = 'return prevValue + 1;';
        }
      }
      if (isDefined(this.dataKeySettingsSchema.schema)) {
        result.settings = this.utils.generateObjectFromJsonSchema(this.dataKeySettingsSchema.schema);
      }
      return result;
    }
  }

  private genNextLabel(name: string): string {
    let label = name;
    let i = 1;
    let matches = false;
    const datasources = this.widgetType === widgetType.alarm ? [this.modelValue.config.alarmSource] : this.modelValue.config.datasources;
    if (datasources) {
      do {
        matches = false;
        datasources.forEach((datasource) => {
          if (datasource && datasource.dataKeys) {
            datasource.dataKeys.forEach((dataKey) => {
              if (dataKey.label === label) {
                i++;
                label = name + ' ' + i;
                matches = true;
              }
            });
          }
        });
      } while (matches);
    }
    return label;
  }

  private genNextColor(): string {
    let i = 0;
    const datasources = this.widgetType === widgetType.alarm ? [this.modelValue.config.alarmSource] : this.modelValue.config.datasources;
    if (datasources) {
      datasources.forEach((datasource) => {
        if (datasource && datasource.dataKeys) {
          i += datasource.dataKeys.length;
        }
      });
    }
    return this.utils.getMaterialColor(i);
  }

  private createEntityAlias(alias: string, allowedEntityTypes: Array<EntityType>): Observable<EntityAlias> {
    const singleEntityAlias: EntityAlias = {id: null, alias, filter: {resolveMultiple: false}};
    return this.dialog.open<EntityAliasDialogComponent, EntityAliasDialogData,
      EntityAlias>(EntityAliasDialogComponent, {
      disableClose: true,
      panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
      data: {
        isAdd: true,
        allowedEntityTypes,
        entityAliases: this.entityAliases,
        alias: singleEntityAlias
      }
    }).afterClosed().pipe(
      tap((entityAlias) => {
        if (entityAlias) {
          this.entityAliases[entityAlias.id] = entityAlias;
          this.aliasController.updateEntityAliases(this.entityAliases);
        }
      })
    );
  }

  public validate(c: FormControl) {
    if (!this.dataSettings.valid) {
      return {
        dataSettings: {
          valid: false
        }
      };
    } else {
      const config = this.modelValue.config;
      if (this.widgetType === widgetType.rpc && this.isDataEnabled) {
        if (!config.targetDeviceAliasIds || !config.targetDeviceAliasIds.length) {
          return {
            targetDeviceAliasIds: {
              valid: false
            }
          };
        }
      } else if (this.widgetType === widgetType.alarm && this.isDataEnabled) {
        if (!config.alarmSource) {
          return {
            alarmSource: {
              valid: false
            }
          };
        }
      } else if (this.widgetType !== widgetType.static && this.isDataEnabled) {
        if (!config.datasources || !config.datasources.length) {
          return {
            datasources: {
              valid: false
            }
          };
        }
      }
      try {
        JSON.parse(this.widgetStyle);
      } catch (e) {
        return {
          widgetStyle: {
            valid: false
          }
        };
      }
      try {
        JSON.parse(this.titleStyle);
      } catch (e) {
        return {
          titleStyle: {
            valid: false
          }
        };
      }
    }
    return null;
  }

}
