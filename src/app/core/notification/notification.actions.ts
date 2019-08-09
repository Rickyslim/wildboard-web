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

import { Action } from '@ngrx/store';
import { NotificationMessage } from '@app/core/notification/notification.models';

export enum NotificationActionTypes {
  SHOW_NOTIFICATION = '[Notification] Show'
}

export class ActionNotificationShow implements Action {
  readonly type = NotificationActionTypes.SHOW_NOTIFICATION;

  constructor(readonly notification: NotificationMessage ) {}
}

export type NotificationActions =
  | ActionNotificationShow;
