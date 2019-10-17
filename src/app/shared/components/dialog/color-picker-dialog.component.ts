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

import { Component, Inject, OnInit, SkipSelf, ViewChild } from '@angular/core';
import { ErrorStateMatcher, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import {
  CONTAINS_TYPE,
  EntityRelation,
  EntitySearchDirection,
  RelationTypeGroup
} from '@shared/models/relation.models';
import { EntityRelationService } from '@core/http/entity-relation.service';
import { EntityId } from '@shared/models/id/entity-id';
import { forkJoin, Observable } from 'rxjs';
import { JsonObjectEditComponent } from '@app/shared/components/json-object-edit.component';
import { Router } from '@angular/router';
import { DialogComponent } from '@app/shared/components/dialog.component';
import { AttributeData, AttributeScope } from '@shared/models/telemetry/telemetry.models';
import { AttributeService } from '@core/http/attribute.service';

export interface ColorPickerDialogData {
  color: string;
}

@Component({
  selector: 'tb-color-picker-dialog',
  templateUrl: './color-picker-dialog.component.html',
  providers: [{provide: ErrorStateMatcher, useExisting: ColorPickerDialogComponent}],
  styleUrls: []
})
export class ColorPickerDialogComponent extends DialogComponent<ColorPickerDialogComponent, string>
  implements OnInit, ErrorStateMatcher {

  colorPickerFormGroup: FormGroup;

  submitted = false;

  constructor(protected store: Store<AppState>,
              protected router: Router,
              @Inject(MAT_DIALOG_DATA) public data: ColorPickerDialogData,
              @SkipSelf() private errorStateMatcher: ErrorStateMatcher,
              public dialogRef: MatDialogRef<ColorPickerDialogComponent, string>,
              public fb: FormBuilder) {
    super(store, router, dialogRef);
  }

  ngOnInit(): void {
    this.colorPickerFormGroup = this.fb.group({
      color: [this.data.color, [Validators.required]]
    });
  }

  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const originalErrorState = this.errorStateMatcher.isErrorState(control, form);
    const customErrorState = !!(control && control.invalid && this.submitted);
    return originalErrorState || customErrorState;
  }

  onColorChange(color: string) {
    this.colorPickerFormGroup.get('color').setValue(color);
    this.colorPickerFormGroup.markAsDirty();
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  select(): void {
    this.submitted = true;
    const color: string = this.colorPickerFormGroup.get('color').value;
    this.dialogRef.close(color);
  }
}
