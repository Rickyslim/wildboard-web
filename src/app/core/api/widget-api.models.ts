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

import { Observable } from 'rxjs';
import { EntityId } from '@app/shared/models/id/entity-id';
import {
  WidgetActionDescriptor,
  widgetType,
  LegendConfig,
  LegendData,
  Datasource,
  DatasourceData, DataSet, DatasourceType, KeyInfo
} from '@shared/models/widget.models';
import { TimeService } from '../services/time.service';
import { DeviceService } from '../http/device.service';
import { AlarmService } from '../http/alarm.service';
import { UtilsService } from '@core/services/utils.service';
import { Timewindow, WidgetTimewindow } from '@shared/models/time/time.models';
import { EntityType } from '@shared/models/entity-type.models';
import { AlarmSearchStatus } from '@shared/models/alarm.models';
import { HttpErrorResponse } from '@angular/common/http';
import { DatasourceService } from '@core/api/datasource.service';
import { RafService } from '@core/services/raf.service';
import { EntityAliases } from '@shared/models/alias.models';
import { EntityInfo } from '@app/shared/models/entity.models';

export interface TimewindowFunctions {
  onUpdateTimewindow: (startTimeMs: number, endTimeMs: number, interval?: number) => void;
  onResetTimewindow: () => void;
}

export interface WidgetSubscriptionApi {
  createSubscription: (options: WidgetSubscriptionOptions, subscribe?: boolean) => Observable<IWidgetSubscription>;
  createSubscriptionFromInfo: (type: widgetType, subscriptionsInfo: Array<SubscriptionInfo>,
                               options: WidgetSubscriptionOptions, useDefaultComponents: boolean, subscribe: boolean)
    => Observable<IWidgetSubscription>;
  removeSubscription: (id: string) => void;
}

export interface RpcApi {
  sendOneWayCommand: (method: string, params?: any, timeout?: number) => Observable<any>;
  sendTwoWayCommand: (method: string, params?: any, timeout?: number) => Observable<any>;
}

export interface IWidgetUtils {
  formatValue: (value: any, dec?: number, units?: string, showZeroDecimals?: boolean) => string | undefined;
}

export interface WidgetActionsApi {
  actionDescriptorsBySourceId: {[sourceId: string]: Array<WidgetActionDescriptor>};
  getActionDescriptors: (actionSourceId: string) => Array<WidgetActionDescriptor>;
  handleWidgetAction: ($event: Event, descriptor: WidgetActionDescriptor,
                       entityId?: EntityId, entityName?: string, additionalParams?: any) => void;
  elementClick: ($event: Event) => void;
}

export interface AliasInfo {
  alias?: string;
  stateEntity?: boolean;
  currentEntity?: EntityInfo;
  selectedId?: string;
  resolvedEntities?: Array<EntityInfo>;
  entityParamName?: string;
  resolveMultiple?: boolean;
}

export interface StateEntityInfo {
  entityParamName: string;
  entityId: EntityId;
}

export interface IAliasController {
  entityAliasesChanged: Observable<Array<string>>;
  entityAliasResolved: Observable<string>;
  getAliasInfo(aliasId: string): Observable<AliasInfo>;
  getEntityAliasId(aliasName: string): string;
  getInstantAliasInfo(aliasId: string): AliasInfo;
  resolveDatasources(datasources: Array<Datasource>): Observable<Array<Datasource>>;
  resolveAlarmSource(alarmSource: Datasource): Observable<Datasource>;
  getEntityAliases(): EntityAliases;
  updateCurrentAliasEntity(aliasId: string, currentEntity: EntityInfo);
  updateEntityAliases(entityAliases: EntityAliases);
  dashboardStateChanged();
}

export interface StateObject {
  id?: string;
  params?: StateParams;
}

export interface StateParams {
  entityName?: string;
  targetEntityParamName?: string;
  entityId?: EntityId;
  [key: string]: any | null;
}

export type StateControllerHolder = () => IStateController;

export interface IStateController {
  getStateParams(): StateParams;
  getStateParamsByStateId(stateId: string): StateParams;
  openState(id: string, params?: StateParams, openRightLayout?: boolean): void;
  updateState(id?: string, params?: StateParams, openRightLayout?: boolean): void;
  resetState(): void;
  openRightLayout(): void;
  preserveState(): void;
  cleanupPreservedStates(): void;
  navigatePrevState(index: number): void;
  getStateId(): string;
  getStateIndex(): number;
  getStateIdAtIndex(index: number): string;
  getEntityId(entityParamName: string): EntityId;
}

export interface SubscriptionInfo {
  type: DatasourceType;
  name?: string;
  entityType?: EntityType;
  entityId?: string;
  entityIds?: Array<string>;
  entityName?: string;
  entityNamePrefix?: string;
  timeseries?: Array<KeyInfo>;
  attributes?: Array<KeyInfo>;
  functions?: Array<KeyInfo>;
  alarmFields?: Array<KeyInfo>;

  deviceId?: string;
  deviceName?: string;
  deviceNamePrefix?: string;
  deviceIds?: Array<string>;
}

export interface WidgetSubscriptionContext {
  timeService: TimeService;
  deviceService: DeviceService;
  alarmService: AlarmService;
  datasourceService: DatasourceService;
  utils: UtilsService;
  raf: RafService;
  widgetUtils: IWidgetUtils;
  dashboardTimewindowApi: TimewindowFunctions;
  getServerTimeDiff: () => Observable<number>;
  aliasController: IAliasController;
  [key: string]: any;
  // TODO:
}

export interface WidgetSubscriptionCallbacks {
  onDataUpdated?: (subscription: IWidgetSubscription, detectChanges: boolean) => void;
  onDataUpdateError?: (subscription: IWidgetSubscription, e: any) => void;
  dataLoading?: (subscription: IWidgetSubscription) => void;
  legendDataUpdated?: (subscription: IWidgetSubscription, detectChanges: boolean) => void;
  timeWindowUpdated?: (subscription: IWidgetSubscription, timeWindowConfig: Timewindow) => void;
  rpcStateChanged?: (subscription: IWidgetSubscription) => void;
  onRpcSuccess?: (subscription: IWidgetSubscription) => void;
  onRpcFailed?: (subscription: IWidgetSubscription) => void;
  onRpcErrorCleared?: (subscription: IWidgetSubscription) => void;
}

export interface WidgetSubscriptionOptions {
  type: widgetType;
  stateData?: boolean;
  alarmSource?: Datasource;
  alarmSearchStatus?: AlarmSearchStatus;
  alarmsPollingInterval?: number;
  datasources?: Array<Datasource>;
  targetDeviceAliasIds?: Array<string>;
  targetDeviceIds?: Array<string>;
  useDashboardTimewindow?: boolean;
  displayTimewindow?: boolean;
  timeWindowConfig?: Timewindow;
  dashboardTimewindow?: Timewindow;
  legendConfig?: LegendConfig;
  decimals?: number;
  units?: string;
  callbacks?: WidgetSubscriptionCallbacks;
}

export interface SubscriptionEntityInfo {
  entityId: EntityId;
  entityName: string;
}

export interface IWidgetSubscription {

  id: string;
  init$: Observable<IWidgetSubscription>;
  ctx: WidgetSubscriptionContext;
  type: widgetType;
  callbacks: WidgetSubscriptionCallbacks;

  loadingData: boolean;
  useDashboardTimewindow: boolean;

  legendData: LegendData;
  datasources?: Array<Datasource>;
  data?: Array<DatasourceData>;
  hiddenData?: Array<{data: DataSet}>;
  timeWindowConfig?: Timewindow;
  timeWindow?: WidgetTimewindow;

  alarmSource?: Datasource;
  alarmSearchStatus?: AlarmSearchStatus;
  alarmsPollingInterval?: number;

  targetDeviceAliasIds?: Array<string>;
  targetDeviceIds?: Array<string>;

  rpcEnabled?: boolean;
  executingRpcRequest?: boolean;
  rpcErrorText?: string;
  rpcRejection?: HttpErrorResponse;

  getFirstEntityInfo(): SubscriptionEntityInfo;

  onAliasesChanged(aliasIds: Array<string>): boolean;

  onDashboardTimewindowChanged(dashboardTimewindow: Timewindow): void;

  updateDataVisibility(index: number): void;

  onUpdateTimewindow(startTimeMs: number, endTimeMs: number, interval?: number): void;
  onResetTimewindow(): void;
  updateTimewindowConfig(newTimewindow: Timewindow): void;

  sendOneWayCommand(method: string, params?: any, timeout?: number): Observable<any>;
  sendTwoWayCommand(method: string, params?: any, timeout?: number): Observable<any>;
  clearRpcError(): void;

  subscribe(): void;

  destroy(): void;

  [key: string]: any;
  // TODO:
}
