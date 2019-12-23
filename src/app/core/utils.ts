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

import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { finalize, share } from 'rxjs/operators';
import base64js from 'base64-js';

export function onParentScrollOrWindowResize(el: Node): Observable<Event> {
  const scrollSubject = new Subject<Event>();
  const scrollParentNodes = scrollParents(el);
  const eventListenerObject: EventListenerObject = {
    handleEvent(evt: Event) {
      scrollSubject.next(evt);
    }
  };
  scrollParentNodes.forEach((scrollParentNode) => {
    scrollParentNode.addEventListener('scroll', eventListenerObject);
  });
  window.addEventListener('resize', eventListenerObject);
  const shared = scrollSubject.pipe(
    finalize(() => {
      scrollParentNodes.forEach((scrollParentNode) => {
        scrollParentNode.removeEventListener('scroll', eventListenerObject);
      });
      window.removeEventListener('resize', eventListenerObject);
    }),
    share()
  );
  return shared;
}

export function isLocalUrl(url: string): boolean {
  const parser = document.createElement('a');
  parser.href = url;
  const host = parser.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  } else {
    return false;
  }
}

export function animatedScroll(element: HTMLElement, scrollTop: number, delay?: number) {
  let currentTime = 0;
  const increment = 20;
  const start = element.scrollTop;
  const to = scrollTop;
  const duration = delay ? delay : 0;
  const remaining = to - start;
  const animateScroll = () => {
    if (duration === 0) {
      element.scrollTop = to;
    } else {
      currentTime += increment;
      const val = easeInOut(currentTime, start, remaining, duration);
      element.scrollTop = val;
      if (currentTime < duration) {
        setTimeout(animateScroll, increment);
      }
    }
  };
  animateScroll();
}

export function isUndefined(value: any): boolean {
  return typeof value === 'undefined';
}

export function isDefined(value: any): boolean {
  return typeof value !== 'undefined';
}

export function isDefinedAndNotNull(value: any): boolean {
  return typeof value !== 'undefined' && value !== null;
}

export function isFunction(value: any): boolean {
  return typeof value === 'function';
}

export function isObject(value: any): boolean {
  return value !== null && typeof value === 'object';
}

export function isNumber(value: any): boolean {
  return typeof value === 'number';
}

export function isNumeric(value: any): boolean {
  return (value - parseFloat( value ) + 1) >= 0;
}

export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function formatValue(value: any, dec?: number, units?: string, showZeroDecimals?: boolean): string | undefined {
  if (isDefined(value) &&
    value != null && isNumeric(value)) {
    let formatted: string | number = Number(value);
    if (isDefined(dec)) {
      formatted = formatted.toFixed(dec);
    }
    if (!showZeroDecimals) {
      formatted = (Number(formatted) * 1);
    }
    formatted = formatted.toString();
    if (isDefined(units) && units.length > 0) {
      formatted += ' ' + units;
    }
    return formatted;
  } else {
    return value;
  }
}

export function deleteNullProperties(obj: any) {
  if (isUndefined(obj) || obj == null) {
    return;
  }
  Object.keys(obj).forEach((propName) => {
    if (obj[propName] === null || isUndefined(obj[propName])) {
      delete obj[propName];
    } else if (isObject(obj[propName])) {
      deleteNullProperties(obj[propName]);
    } else if (obj[propName] instanceof Array) {
      (obj[propName] as any[]).forEach((elem) => {
        deleteNullProperties(elem);
      });
    }
  });
}

export function objToBase64(obj: any): string {
  const json = JSON.stringify(obj);
  const encoded = utf8Encode(json);
  const b64Encoded: string = base64js.fromByteArray(encoded);
  return b64Encoded;
}

export function base64toObj(b64Encoded: string): any {
  const encoded: Uint8Array | number[] = base64js.toByteArray(b64Encoded);
  const json = utf8Decode(encoded);
  const obj = JSON.parse(json);
  return obj;
}

function utf8Encode(str: string): Uint8Array | number[] {
  let result: Uint8Array | number[];
  if (isUndefined(Uint8Array)) {
    result = utf8ToBytes(str);
  } else {
    result = new Uint8Array(utf8ToBytes(str));
  }
  return result;
}

function utf8Decode(bytes: Uint8Array | number[]): string {
  return utf8Slice(bytes, 0, bytes.length);
}

const scrollRegex = /(auto|scroll)/;

function parentNodes(node: Node, nodes: Node[]): Node[] {
  if (node.parentNode === null) {
    return nodes;
  }
  return parentNodes(node.parentNode, nodes.concat([node]));
}

function style(el: Element, prop: string): string {
  return getComputedStyle(el, null).getPropertyValue(prop);
}

function overflow(el: Element): string {
  return style(el, 'overflow') + style(el, 'overflow-y') + style(el, 'overflow-x');
}

function isScrollNode(node: Node): boolean {
  if (node instanceof Element) {
    return scrollRegex.test(overflow(node));
  } else {
    return false;
  }
}

function scrollParents(node: Node): Node[] {
  if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
    return [];
  }
  const scrollParentNodes = [];
  const nodeParents = parentNodes(node, []);
  nodeParents.forEach((nodeParent) => {
    if (isScrollNode(nodeParent)) {
      scrollParentNodes.push(nodeParent);
    }
  });
  if (document.scrollingElement) {
    scrollParentNodes.push(document.scrollingElement);
  } else if (document.documentElement) {
    scrollParentNodes.push(document.documentElement);
  }
  return scrollParentNodes;
}

function easeInOut(
  currentTime: number,
  startTime: number,
  remainingTime: number,
  duration: number) {
  currentTime /= duration / 2;

  if (currentTime < 1) {
    return (remainingTime / 2) * currentTime * currentTime + startTime;
  }

  currentTime--;
  return (
    (-remainingTime / 2) * (currentTime * (currentTime - 2) - 1) + startTime
  );
}

function utf8Slice(buf: Uint8Array | number[], start: number, end: number): string {
  let res = '';
  let tmp = '';
  end = Math.min(buf.length, end || Infinity);
  start = start || 0;

  for (let i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i]);
      tmp = '';
    } else {
      tmp += '%' + buf[i].toString(16);
    }
  }
  return res + decodeUtf8Char(tmp);
}

function decodeUtf8Char(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch (err) {
    return String.fromCharCode(0xFFFD); // UTF 8 invalid char
  }
}

function utf8ToBytes(input: string, units?: number): number[] {
  units = units || Infinity;
  let codePoint: number;
  const length = input.length;
  let leadSurrogate: number = null;
  const bytes: number[] = [];
  let i = 0;

  for (; i < length; i++) {
    codePoint = input.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (leadSurrogate) {
        // 2 leads in a row
        if (codePoint < 0xDC00) {
          units -= 3;
          if (units > -1) { bytes.push(0xEF, 0xBF, 0xBD); }
          leadSurrogate = codePoint;
          continue;
        } else {
          // valid surrogate pair
          // tslint:disable-next-line:no-bitwise
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000;
          leadSurrogate = null;
        }
      } else {
        // no lead yet

        if (codePoint > 0xDBFF) {
          // unexpected trail
          units -= 3;
          if (units > -1) { bytes.push(0xEF, 0xBF, 0xBD); }
          continue;
        } else if (i + 1 === length) {
          // unpaired lead
          units -= 3;
          if (units > -1) { bytes.push(0xEF, 0xBF, 0xBD); }
          continue;
        } else {
          // valid lead
          leadSurrogate = codePoint;
          continue;
        }
      }
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      units -= 3;
      if (units > -1) { bytes.push(0xEF, 0xBF, 0xBD); }
      leadSurrogate = null;
    }

    // encode utf8
    if (codePoint < 0x80) {
      units -= 1;
      if (units < 0) { break; }
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      units -= 2;
      if (units < 0) { break; }
      bytes.push(
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0x6 | 0xC0,
        // tslint:disable-next-line:no-bitwise
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      units -= 3;
      if (units < 0) { break; }
      bytes.push(
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0xC | 0xE0,
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0x6 & 0x3F | 0x80,
        // tslint:disable-next-line:no-bitwise
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x200000) {
      units -= 4;
      if (units < 0) { break; }
      bytes.push(
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0x12 | 0xF0,
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0xC & 0x3F | 0x80,
        // tslint:disable-next-line:no-bitwise
        codePoint >> 0x6 & 0x3F | 0x80,
        // tslint:disable-next-line:no-bitwise
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point');
    }
  }
  return bytes;
}

export function deepClone<T>(target: T): T {
  if (target === null) {
    return target;
  }
  if (target instanceof Date) {
    return new Date(target.getTime()) as any;
  }
  if (target instanceof Array) {
    const cp = [] as any[];
    (target as any[]).forEach((v) => { cp.push(v); });
    return cp.map((n: any) => deepClone<any>(n)) as any;
  }
  if (typeof target === 'object' && target !== {}) {
    const cp = { ...(target as { [key: string]: any }) } as { [key: string]: any };
    Object.keys(cp).forEach(k => {
      cp[k] = deepClone<any>(cp[k]);
    });
    return cp as T;
  }
  return target;
}

export function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

const SNAKE_CASE_REGEXP = /[A-Z]/g;

export function snakeCase(name: string, separator: string): string {
  separator = separator || '_';
  return name.replace(SNAKE_CASE_REGEXP, (letter, pos) => {
    return (pos ? separator : '') + letter.toLowerCase();
  });
}
