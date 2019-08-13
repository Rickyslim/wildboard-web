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

import { BaseData, HasId } from '@shared/models/base-data';
import { EntityId } from '@shared/models/id/entity-id';
import { EntitiesFetchFunction } from '@shared/models/datasource/entity-datasource';
import { Observable, of } from 'rxjs';
import { emptyPageData } from '@shared/models/page/page-data';
import { DatePipe } from '@angular/common';
import { Direction, SortOrder } from '@shared/models/page/sort-order';
import {
  EntityType,
  EntityTypeResource,
  EntityTypeTranslation
} from '@shared/models/entity-type.models';
import { EntityComponent } from '@shared/components/entity/entity.component';
import { Type } from '@angular/core';
import { EntityAction } from '@shared/components/entity/entity-component.models';
import { HasUUID } from '@shared/models/id/has-uuid';
import { PageLink } from '@shared/models/page/page-link';
import { EntitiesTableComponent } from '@shared/components/entity/entities-table.component';
import { EntityTableHeaderComponent } from '@shared/components/entity/entity-table-header.component';
import { ActivatedRoute } from '@angular/router';

export type EntityBooleanFunction<T extends BaseData<HasId>> = (entity: T) => boolean;
export type EntityStringFunction<T extends BaseData<HasId>> = (entity: T) => string;
export type EntityCountStringFunction = (count: number) => string;
export type EntityTwoWayOperation<T extends BaseData<HasId>> = (entity: T) => Observable<T>;
export type EntityByIdOperation<T extends BaseData<HasId>> = (id: HasUUID) => Observable<T>;
export type EntityIdOneWayOperation = (id: HasUUID) => Observable<any>;
export type EntityActionFunction<T extends BaseData<HasId>> = (action: EntityAction<T>) => boolean;
export type CreateEntityOperation<T extends BaseData<HasId>> = () => Observable<T>;

export type CellContentFunction<T extends BaseData<HasId>> = (entity: T, key: string) => string;
export type CellStyleFunction<T extends BaseData<HasId>> = (entity: T, key: string) => object;

export interface CellActionDescriptor<T extends BaseData<HasId>> {
  name: string;
  nameFunction?: (entity: T) => string;
  icon?: string;
  isMdiIcon?: boolean;
  color?: string;
  isEnabled: (entity: T) => boolean;
  onAction: ($event: MouseEvent, entity: T) => void;
}

export interface GroupActionDescriptor<T extends BaseData<HasId>> {
  name: string;
  icon: string;
  isEnabled: boolean;
  onAction: ($event: MouseEvent, entities: T[]) => void;
}

export interface HeaderActionDescriptor {
  name: string;
  icon: string;
  isEnabled: () => boolean;
  onAction: ($event: MouseEvent) => void;
}

export class EntityTableColumn<T extends BaseData<HasId>> {
  constructor(public key: string,
              public title: string,
              public maxWidth: string = '100%',
              public cellContentFunction: CellContentFunction<T> = (entity, property) => entity[property],
              public cellStyleFunction: CellStyleFunction<T> = () => ({}),
              public sortable: boolean = true) {
  }
}

export class DateEntityTableColumn<T extends BaseData<HasId>> extends EntityTableColumn<T> {
  constructor(key: string,
              title: string,
              datePipe: DatePipe,
              maxWidth: string = '100%',
              dateFormat: string = 'yyyy-MM-dd HH:mm:ss',
              cellStyleFunction: CellStyleFunction<T> = () => ({})) {
    super(key,
          title,
          maxWidth,
          (entity, property) => datePipe.transform(entity[property], dateFormat),
          cellStyleFunction);
  }
}

export class EntityTableConfig<T extends BaseData<HasId>, P extends PageLink = PageLink> {

  constructor() {}

  componentsData: any = null;

  loadDataOnInit = true;
  onLoadAction: (route: ActivatedRoute) => void = null;
  table: EntitiesTableComponent = null;
  useTimePageLink = false;
  entityType: EntityType = null;
  tableTitle = '';
  selectionEnabled = true;
  searchEnabled = true;
  addEnabled = true;
  entitiesDeleteEnabled = true;
  detailsPanelEnabled = true;
  actionsColumnTitle = null;
  entityTranslations: EntityTypeTranslation;
  entityResources: EntityTypeResource;
  entityComponent: Type<EntityComponent<T>>;
  defaultSortOrder: SortOrder = {property: 'createdTime', direction: Direction.ASC};
  columns: Array<EntityTableColumn<T>> = [];
  cellActionDescriptors: Array<CellActionDescriptor<T>> = [];
  groupActionDescriptors: Array<GroupActionDescriptor<T>> = [];
  headerActionDescriptors: Array<HeaderActionDescriptor> = [];
  headerComponent: Type<EntityTableHeaderComponent<T>>;
  addEntity: CreateEntityOperation<T> = null;
  detailsReadonly: EntityBooleanFunction<T> = () => false;
  deleteEnabled: EntityBooleanFunction<T> = () => true;
  deleteEntityTitle: EntityStringFunction<T> = () => '';
  deleteEntityContent: EntityStringFunction<T> = () => '';
  deleteEntitiesTitle: EntityCountStringFunction = () => '';
  deleteEntitiesContent: EntityCountStringFunction = () => '';
  loadEntity: EntityByIdOperation<T> = () => of();
  saveEntity: EntityTwoWayOperation<T> = (entity) => of(entity);
  deleteEntity: EntityIdOneWayOperation = () => of();
  entitiesFetchFunction: EntitiesFetchFunction<T, P> = () => of(emptyPageData<T>());
  onEntityAction: EntityActionFunction<T> = () => false;
}

export function checkBoxCell(value: boolean): string {
  return `<mat-icon class="material-icons mat-icon">${value ? 'check_box' : 'check_box_outline_blank'}</mat-icon>`;
}
