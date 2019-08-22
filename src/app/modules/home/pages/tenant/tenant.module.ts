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

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import {TenantComponent} from '@modules/home/pages/tenant/tenant.component';
import {TenantRoutingModule} from '@modules/home/pages/tenant/tenant-routing.module';
import {HomeComponentsModule} from '@modules/home/components/home-components.module';
import { TenantTabsComponent } from '@home/pages/tenant/tenant-tabs.component';

@NgModule({
  entryComponents: [
    TenantComponent,
    TenantTabsComponent
  ],
  declarations: [
    TenantComponent,
    TenantTabsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    HomeComponentsModule,
    TenantRoutingModule
  ]
})
export class TenantModule { }
