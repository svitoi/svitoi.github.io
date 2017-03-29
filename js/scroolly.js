(function (root, factory) {
"use strict";
if (typeof define === 'function' && define.amd) {
define(['jquery'], function ($) {
return factory(root, $, false);
});
return;
}
factory(root, (root.jQuery || root.Zepto || root.ender || root.$), true);
}(this, function (root, $, patchJQuery) {
"use strict";
var scroolly;
scroolly = {
options: {
timeout: null,
meter: $('.scroolly'),
body: document
},
theCSSPrefix: '',
theDashedCSSPrefix: '',
isMobile: false,
isInitialized: false,
animFrame: null,
direction: 0,
scrollTop: 0,
scrollCenter: 0,
scrollBottom: 0,
docHeight: 0,
docMiddle: 0,
winHeight: $(window).height()
};
scroolly.scrollLayout = {
};
scroolly._isObject = function (val) {
return typeof val === 'object';
};
scroolly._isArray = function (val) {
return val instanceof Array;
};
scroolly._isNumber = function (val) {
return val instanceof Number || typeof val === 'number';
};
scroolly._isString = function (val) {
return val instanceof String || typeof val === 'string';
};
scroolly._default = function (obj, key, defaultValue) {
if (defaultValue === undefined) {
defaultValue = null;
}
var parts = (key + '').split('.');
if (obj && (scroolly._isObject(obj) || scroolly._isArray(obj))) {
var root = obj,
part;
for (var i in parts) {
part = parts[i];
if ((scroolly._isObject(root) || scroolly._isArray(root)) && root[part] !== undefined) {
root = root[part];
} else {
return defaultValue;
}
}
return root;
}
return defaultValue;
};
scroolly.parseCoords = function (boundry) {
var strings = boundry.split(/\s*=\s*/),
coordRel = strings[0] || 'doc-top',
parsedCoordRel = scroolly.parseCoord(coordRel),
coordVP = strings[1] || parsedCoordRel.anchor,
parsedCoordVP = scroolly.parseCoord(coordVP);
return [parsedCoordRel, parsedCoordVP];
};
scroolly.parseCoord = function (coord) {
var reAnchor = /((vp|doc|el|con)-)?(top|center|bottom)?/i,
reOffsetStr = '(\\+|-)?\\s*(\\d+)(\\%|vp|doc|el|con)?',
reOffset = new RegExp(reOffsetStr, 'gi'),
mA = coord.match(reAnchor),
mO = coord.match(reOffset);
if (!mA && !mO) {
return false;
}
var subject = mA[1] ? mA[2] : 'vp',
anchor = mA[3] || 'top',
offsets = [];
if (mO) {
reOffset = new RegExp(reOffsetStr, 'i');
var offsetStr,
mO2,
sign,
offset,
offsetSubject;
for (var i = 0; i < mO.length; i++) {
offsetStr = mO[i];
mO2 = offsetStr.match(reOffset);
sign = mO2[1] && mO2[1] === '-' ? -1 : 1;
offset = mO2[2] && parseInt(mO2[2]) * sign || 0;
offsetSubject = 'px';
if (mO2[3]) {
offsetSubject = mO2[3] === '%' ? subject : mO2[3];
}
offsets.push({
offset: offset,
subject: offsetSubject
});
}
}
return {
original: coord,
subject: subject,
anchor: anchor,
offsets: offsets
};
};
scroolly.calculateCoord = function (coord, $element, $container) {
if (scroolly._isString(coord)) {
coord = scroolly.parseCoord(coord);
}
var subjectCoord = 0;
if ('vp' === coord.subject) {
switch (coord.anchor) {
case 'top':
subjectCoord = scroolly.scrollTop;
break;
case 'center':
subjectCoord = scroolly.scrollCenter;
break;
case 'bottom':
subjectCoord = scroolly.scrollBottom;
break
}
} else if ('doc' === coord.subject) {
switch (coord.anchor) {
case 'top':
subjectCoord = 0;
break;
case 'center':
subjectCoord = scroolly.docMiddle;
break;
case 'bottom':
subjectCoord = scroolly.docHeight;
}
} else {
var $subject = 'con' === coord.subject ? $container : $element,
subjectHeight = $subject.outerHeight(),
subjectTop = $subject.offset().top,
subjectBottom = subjectTop + subjectHeight,
subjectCenter = subjectTop + Math.floor(subjectHeight / 2);
switch (coord.anchor) {
case 'top':
subjectCoord = subjectTop;
break;
case 'center':
subjectCoord = subjectCenter;
break;
case 'bottom':
subjectCoord = subjectBottom;
break;
}
}
var i, o, subjectOffset, relativeHeight;
for (i = 0; i < coord.offsets.length; i++) {
o = coord.offsets[i];
subjectOffset = o.offset;
if ('px' !== o.subject) {
relativeHeight = 0;
switch (o.subject) {
case 'vp':
relativeHeight = scroolly.winHeight;
break;
case 'doc':
relativeHeight = scroolly.docHeight;
break;
case 'el':
relativeHeight = $element.outerHeight();
break;
case 'con':
relativeHeight = $container.outerHeight();
break;
}
subjectOffset = Math.ceil(o.offset / 100 * relativeHeight);
}
subjectCoord += subjectOffset;
}
return subjectCoord;
};
scroolly.cmpCoords = function (coords, $element, $container) {
return scroolly.calculateCoord(coords[0], $element, $container) - scroolly.calculateCoord(coords[1], $element, $container);
};
scroolly.isRuleInActiveWidthRange = function (rule) {
var fromX = scroolly._default(rule, 'minWidth', 0),
toX = scroolly._default(rule, 'maxWidth', 'infinity'),
meter = scroolly._default(scroolly.options, 'meter'),
width = $(window).width(),
minWidthScrolly,
maxWidthScrolly,
checkinWidth;
if (meter.length) {
minWidthScrolly = meter.length ? parseInt(meter.css('min-width')) : 0;
maxWidthScrolly = meter.length ? meter.css('max-width') : 'none';
maxWidthScrolly = maxWidthScrolly === 'none' ? 'infinity' : parseInt(maxWidthScrolly);
checkinWidth = fromX <= minWidthScrolly && (toX === 'infinity' || toX >= maxWidthScrolly);
return checkinWidth;
}
return fromX < width && (toX === 'infinity' || toX >= width);
};
scroolly.isRuleActive = function (rule, $element, $container) {
var checkinWidth = scroolly.isRuleInActiveWidthRange(rule);
if (!checkinWidth) {
return false;
}
var ruleDirection = scroolly._default(rule, 'direction', 0),
scrollDirection = scroolly.direction;
if (ruleDirection && (ruleDirection > 0 && scrollDirection < 0 || ruleDirection < 0 && scrollDirection >= 0)) {
return false;
}
var fromY = scroolly._default(rule, 'from', '0'),
toY = scroolly._default(rule, 'to', 'finish');
var toTop = scroolly.cmpCoords(fromY, $element, $container);
if (toTop > 0) {
return false;
}
var toBottom = scroolly.cmpCoords(toY, $element, $container);
if (toBottom <= 0) {
return false;
}
return {
offset: -toTop,
length: toBottom - toTop
};
};
scroolly.addItem = function (id, $element, rules, $container) {
if (!$element.length) {
return false;
}
$container = $container || 'self';
var rule,
isAbsolute,
fromY,
toY,
fromCss,
toCss,
cssOnScroll
for (var i in rules) {
rule = rules[i];
isAbsolute = !$container;
fromY = scroolly._default(rule, 'from', 'doc-top');
if (scroolly._isString(fromY) || scroolly._isNumber(fromY)) {
fromY = scroolly.parseCoords('' + fromY);
rule.from = fromY;
}
toY = scroolly._default(rule, 'to', 'doc-bottom');
if (scroolly._isString(toY) || scroolly._isNumber(toY)) {
toY = scroolly.parseCoords('' + toY);
rule.to = toY;
}
fromCss = scroolly._default(rule, 'cssFrom');
toCss = scroolly._default(rule, 'cssTo');
if (fromCss && toCss) {
cssOnScroll = function (element, offset, length, rule) {
var progress = offset / length,
fromCss = scroolly._default(rule, 'cssFrom'),
toCss = scroolly._default(rule, 'cssTo'),
css = {},
fromProp,
toProp;
for (var property in fromCss) {
fromProp = fromCss[property];
toProp = scroolly._default(toCss, property, fromProp);
css[property] = scroolly.getTransitionValue(fromProp, toProp, progress);
}
element.css(scroolly.extendCssWithPrefix(css));
};
rule.cssOnScroll = cssOnScroll;
}
}
if ($element.length > 1) {
$element.each(function (i) {
var clonedRules = [],
rule,
clonedRule,
$con = null;
for (var j = 0; j < rules.length; j++) {
rule = rules[j];
clonedRule = {};
$.extend(clonedRule, rule);
clonedRules.push(clonedRule);
}
if ($container) {
if ($container === 'self') {
$con = $container;
} else {
$con = $container.length > 1 && i < $container.length ? $($container[i]) : $container;
}
}
scroolly.addItem(id + '-' + i, $(this), clonedRules, $con);
});
return true;
}
var item = scroolly._default(scroolly.scrollLayout, id);
if (item) {
item.rules.concat(rules);
} else {
scroolly.scrollLayout[id] = {
element: $element,
container: $container,
rules: rules
};
}
return true;
};
scroolly.factory = function ($element, rules, $container, id) {
scroolly.init();
if (!$element.length) {
return false;
}
if (!rules) {
return false;
}
id = id || $element[0].tagName + '_' + Object.keys(scroolly.scrollLayout).length;
scroolly.addItem(id, $element, rules, $container, false);
};
scroolly.stickItem = function (id, $element, params) {
scroolly.stickItemXY(id, $element, (params instanceof Array) ? params : [params]);
};
scroolly.stickItemXY = function (id, $element, params) {
params = params || [];
var rules = [],
xRange,
$bottomContainer,
mode,
offsetTop,
offsetBottom,
minWidth,
maxWidth,
isStatic
;
for (var x in params) {
xRange = params[x];
$bottomContainer = scroolly._default(xRange, '$bottomContainer', $('body'));
mode = scroolly._default(xRange, 'mode');
offsetTop = scroolly._default(xRange, 'offsetTop', 0);
offsetBottom = scroolly._default(xRange, 'offsetBottom', 0);
minWidth = scroolly._default(xRange, 'minWidth', 0);
maxWidth = scroolly._default(xRange, 'maxWidth', 'infinity');
isStatic = scroolly._default(xRange, 'static', false);
if ('next' === $bottomContainer) {
mode = mode || 'margin';
$bottomContainer = $($element).next();
} else if ('parent' === $bottomContainer || !$bottomContainer) {
mode = mode || 'padding';
$bottomContainer = $($element).parent();
}
if (!isStatic) {
rules.push({
source: 'sticky',
alias: 'top',
minWidth: minWidth,
maxWidth: maxWidth,
offsetTop: offsetTop,
offsetBottom: offsetBottom,
bottomContainer: $bottomContainer,
mode: mode
});
rules.push({
source: 'sticky',
alias: 'fixed',
minWidth: minWidth,
maxWidth: maxWidth,
offsetTop: offsetTop,
offsetBottom: offsetBottom,
bottomContainer: $bottomContainer,
mode: mode
});
rules.push({
source: 'sticky',
alias: 'bottom',
minWidth: minWidth,
maxWidth: maxWidth,
offsetTop: offsetTop,
offsetBottom: offsetBottom,
bottomContainer: $bottomContainer,
mode: mode
});
} else {
rules.push({
source: 'sticky',
alias: 'static',
minWidth: minWidth,
maxWidth: maxWidth,
bottomContainer: $bottomContainer
});
}
}
scroolly.addItem(id, $($element), rules);
};
scroolly.processStickyItemRange = function ($element, rule) {
rule = rule || {};
var $bottomContainer = scroolly._default(rule, 'bottomContainer', $('body')),
mode = scroolly._default(rule, 'mode'),
offsetTop = scroolly._default(rule, 'offsetTop', 0),
offsetBottom = scroolly._default(rule, 'offsetBottom', 0),
itemHeight = parseInt($element.css('margin-top')) + $element.height() + parseInt($element.css('margin-bottom'));
if ($element.css('box-sizing') === 'border-box') {
itemHeight += parseInt($element.css('padding-top')) + parseInt($element.css('padding-bottom'));
}
var bottomContainerHeight = parseInt($bottomContainer.css('margin-top')) + $bottomContainer.height() + parseInt($bottomContainer.css('margin-bottom'));
if ($bottomContainer.css('box-sizing') === 'border-box') {
bottomContainerHeight += parseInt($bottomContainer.css('padding-top')) + parseInt($bottomContainer.css('padding-bottom'));
}
var offset_1 = Math.round($element.offset().top - parseInt($element.css('margin-top'))),
offset_2 = Math.round($bottomContainer.offset().top + (bottomContainerHeight - itemHeight - offsetBottom));
switch (rule.alias) {
case 'top':
rule.from = 0;
rule.to = offset_1 - offsetTop;
rule.css = {'position': 'absolute', 'top': offset_1 + 'px'};
rule.itemHeight = itemHeight;
break;
case 'fixed':
rule.from = offset_1 - offsetTop;
rule.to = offset_2;
rule.css = {'position': 'fixed', 'top': offsetTop + 'px'};
rule.itemHeight = itemHeight;
break;
case 'bottom':
rule.from = offset_2;
rule.css = {'position': 'absolute', 'top': (offset_2 + offsetTop) + 'px'};
rule.itemHeight = itemHeight;
break;
case 'static':
rule.from = 0;
rule.css = {'position': '', 'top': ''};
rule.itemHeight = 0;
break;
}
return rule;
};
scroolly.onResize = function () {
scroolly.winHeight = $(window).height();
scroolly.docHeight = scroolly.body.height();
scroolly.docMiddle = Math.floor(scroolly.docHeight / 2);
var needScroll = false;
for (var id in scroolly.scrollLayout) {
var item = scroolly.scrollLayout[id],
rule,
checkin,
source
;
for (var i in item.rules) {
rule = item.rules[i];
checkin = scroolly.isRuleInActiveWidthRange(rule);
needScroll |= checkin;
if (checkin && rule.from === undefined) {
$(item.element).css('position', '');
$(item.element).css('top', '');
if (rule.bottomContainer) {
rule.bottomContainer.css('margin-top', '');
}
source = scroolly._default(rule, 'source');
if ('sticky' === source) {
item.rules[i] = scroolly.processStickyItemRange(item.element, rule);
}
}
}
}
if (needScroll) {
scroolly.scrollLayout = scroolly.scrollLayout;
setTimeout(function () {
scroolly.onScroll(true);
}, 0);
}
return true;
};
scroolly.getProgress = function (offset, length) {
var relative = offset / length;
return {
offset: offset,
length: length,
relative: relative,
left: length - offset,
leftRelative: 1 - relative
};
};
scroolly.getTransitionFloatValue = function (start, stop, progress) {
if (progress <= 0) {
return start;
}
if (progress >= 1) {
return stop;
}
return start + (stop - start) * progress;
};
scroolly.getTransitionIntValue = function (start, stop, progress) {
return Math.round(scroolly.getTransitionFloatValue(start, stop, progress));
};
scroolly.hashColor2rgb = function (color) {
var m = color.match(/^#([0-9a-f]{3})$/i);
if (m) {
return [
parseInt(m[1].charAt(0), 16) * 0x11, parseInt(m[1].charAt(1), 16) * 0x11, parseInt(m[1].charAt(2), 16) * 0x11
];
} else {
m = color.match(/^#([0-9a-f]{6})$/i);
if (m) {
return [
parseInt(m[1].substr(0, 2), 16), parseInt(m[1].substr(2, 2), 16), parseInt(m[1].substr(4, 2), 16)
];
}
}
return [0, 0, 0];
};
scroolly.rgb2HashColor = function (r, g, b) {
var res = '#', c, hex;
for (var i in arguments) {
c = arguments[i];
hex = c.toString(16);
if (c < 16) {
hex = '0' + hex;
}
res += hex;
}
return res;
};
scroolly.getTransitionColorValue = function (start, stop, progress) {
if (progress <= 0) {
return start;
}
if (progress >= 1) {
return stop;
}
var startRGB = scroolly.hashColor2rgb(start),
stopRGB = scroolly.hashColor2rgb(stop),
r = scroolly.getTransitionIntValue(startRGB[0], stopRGB[0], progress),
g = scroolly.getTransitionIntValue(startRGB[1], stopRGB[1], progress),
b = scroolly.getTransitionIntValue(startRGB[2], stopRGB[2], progress);
return scroolly.rgb2HashColor(r, g, b);
};
scroolly.getTransitionValue = function (start, stop, progress) {
if (progress <= 0) {
return start;
}
if (progress >= 1) {
return stop;
}
var called = 0;
if (scroolly._isNumber(start) && scroolly._isNumber(stop)) {
return scroolly.getTransitionFloatValue(start, start, progress);
}
var re = /(\d*\.\d+)|(\d+)|(#[0-9a-f]{6})|(#[0-9a-f]{3})/gi,
stops = ('' + stop).match(re);
return ('' + start).replace(re, function (value, float, int, color6, color3) {
var currentStop = stops[called];
called++;
if (int && int.length) {
return /\d*\.\d+/.test(currentStop) ? scroolly.getTransitionFloatValue(parseFloat(value), parseFloat(currentStop), progress) : scroolly.getTransitionIntValue(parseInt(value), parseInt(currentStop), progress);
}
if (float && float.length) {
return scroolly.getTransitionFloatValue(parseFloat(value), parseFloat(currentStop), progress);
}
if (color6 && color6.length || color3 && color3.length) {
return scroolly.getTransitionColorValue(value, currentStop, progress);
}
return value;
});
};
scroolly.onScroll = function (force) {
var scrollPos = scroolly.body.scrollTop();
if (!force && scrollPos === scroolly.scrollTop) {
return false;
}
var prevPos = scroolly.scrollTop,
prevDirection = scroolly.direction;
scroolly.scrollTop = scrollPos;
scroolly.scrollBottom = scrollPos + scroolly.winHeight;
scroolly.scrollCenter = scrollPos + Math.floor(scroolly.winHeight / 2);
scroolly.direction = scrollPos - prevPos;
var directionChanged = !(scroolly.direction === prevDirection || scroolly.direction < 0 && prevDirection < 0 || scroolly.direction > 0 && prevDirection > 0),
item,
totalRules,
checkedIn,
checkedOut,
active,
id, i, l, j,
rule,
fromX,
toX,
container,
$bottomContainer,
mode,
itemHeight;
for (id in scroolly.scrollLayout) {
item = scroolly.scrollLayout[id];
totalRules = item.rules.length;
checkedIn = [];
checkedOut = [];
active = [];
for (i = 0; i < totalRules; i++) {
rule = item.rules[i];
fromX = scroolly._default(rule, 'minWidth', 0);
toX = scroolly._default(rule, 'maxWidth', 'infinity');
container = item.container === 'self' ? item.element : item.container;
rule.checkin = scroolly.isRuleActive(rule, item.element, container);
rule.class = rule.class || 'scroll-pos-' + (rule.alias) + ' window-width-' + fromX + '-to-' + toX;
if (rule.checkin) {
active.push(i);
if (!rule.isActive) {
rule.isActive = true;
checkedIn.push(i);
}
} else if (rule.isActive) {
rule.isActive = false;
checkedOut.push(i);
}
item.rules[i] = rule;
}
for (j = 0; j < checkedOut.length; j++) {
i = checkedOut[j];
rule = item.rules[i];
item.element.removeClass(rule.class);
if (rule.cssOnScroll) {
l = rule.length || 0;
rule.cssOnScroll(item.element, scrollPos > prevPos ? l : 0, l, rule);
}
if (rule.onScroll) {
l = rule.length || 0;
rule.onScroll(item.element, scrollPos > prevPos ? l : 0, l, rule);
}
if (rule.onCheckOut) {
rule.onCheckOut(item.element, rule);
}
if (rule.onTopOut && scrollPos < prevPos) {
rule.onTopOut(item.element, rule);
} else if (rule.onBottomOut && scrollPos > prevPos) {
rule.onBottomOut(item.element, rule);
}
}
for (j = 0; j < checkedIn.length; j++) {
i = checkedIn[j];
rule = item.rules[i];
if (rule.css) {
item.element.css(scroolly.extendCssWithPrefix(rule.css));
}
if (rule.addClass) {
item.element.addClass(rule.addClass);
}
if (rule.removeClass) {
item.element.removeClass(rule.removeClass);
}
item.element.addClass(rule.class);
$bottomContainer = scroolly._default(rule, 'bottomContainer');
mode = scroolly._default(rule, 'mode');
itemHeight = scroolly._default(rule, 'itemHeight');
if ($bottomContainer && mode && itemHeight) {
$bottomContainer.css(mode + '-top', itemHeight + 'px');
}
if (rule.onCheckIn) {
rule.onCheckIn(item.element, rule);
}
if (rule.onTopIn && scrollPos > prevPos) {
rule.onTopIn(item.element, rule);
} else if (rule.onBottomIn && scrollPos < prevPos) {
rule.onBottomIn(item.element, rule);
}
rule.length = rule.checkin.length;
}
for (j = 0; j < active.length; j++) {
i = active[j];
rule = item.rules[i];
if (rule.cssOnScroll) {
rule.cssOnScroll(item.element, rule.checkin.offset, rule.checkin.length, rule);
}
if (rule.onScroll) {
rule.onScroll(item.element, rule.checkin.offset, rule.checkin.length, rule);
}
if (directionChanged && rule.onDirectionChanged) {
rule.onDirectionChanged(item.element, scroolly.direction, rule);
}
}
scroolly.scrollLayout[id] = item;
}
};
scroolly.detectCSSPrefix = function () {
var rxPrefixes = /^(?:O|Moz|webkit|ms)|(?:-(?:o|moz|webkit|ms)-)/;
if (!window.getComputedStyle) {
return;
}
var style = window.getComputedStyle(document.body, null);
for (var k in style) {
scroolly.theCSSPrefix = (k.match(rxPrefixes) || (+k === k && style[k].match(rxPrefixes)));
if (scroolly.theCSSPrefix) {
break;
}
}
if (!scroolly.theCSSPrefix) {
scroolly.theCSSPrefix = scroolly.theDashedCSSPrefix = '';
return;
}
scroolly.theCSSPrefix = scroolly.theCSSPrefix[0];
if (scroolly.theCSSPrefix.slice(0, 1) === '-') {
scroolly.theDashedCSSPrefix = scroolly.theCSSPrefix;
scroolly.theCSSPrefix = ({
'-webkit-': 'webkit',
'-moz-': 'Moz',
'-ms-': 'ms',
'-o-': 'O'
})[scroolly.theCSSPrefix];
} else {
scroolly.theDashedCSSPrefix = '-' + scroolly.theCSSPrefix.toLowerCase() + '-';
}
};
scroolly.cssPrefix = function (key) {
return scroolly.theDashedCSSPrefix + key;
};
scroolly.extendCssWithPrefix = function (cssObj) {
var cssExt = {}, prop, re, m, newProp, val;
for (prop in cssObj) {
re = /^-(moz-|webkit-|o-|ms-)?/i;
m = prop.match(re);
newProp = prop.slice(1);
if (m && !m[1]) {
val = cssObj[prop];
cssExt[newProp] = val;
cssExt[scroolly.cssPrefix(newProp)] = val;
delete cssObj[prop];
}
}
$.extend(cssObj, cssExt);
return cssObj;
};
scroolly.now = Date.now || function () {
return +new Date();
};
scroolly.getRAF = function () {
var requestAnimFrame = window.requestAnimationFrame || window[scroolly.theCSSPrefix.toLowerCase() + 'RequestAnimationFrame'],
lastTime = scroolly.now();
if (false && scroolly.isMobile || !requestAnimFrame) {
requestAnimFrame = function (callback) {
var deltaTime = scroolly.now() - lastTime,
delay = Math.max(0, 1000 / 60 - deltaTime);
return window.setTimeout(function () {
lastTime = scroolly.now();
callback();
}, delay);
};
}
return requestAnimFrame;
};
scroolly.getCAF = function () {
var cancelAnimFrame = window.cancelAnimationFrame || window[scroolly.theCSSPrefix.toLowerCase() + 'CancelAnimationFrame'];
if (scroolly.isMobile || !cancelAnimFrame) {
cancelAnimFrame = function (timeout) {
return window.clearTimeout(timeout);
};
}
return cancelAnimFrame;
};
scroolly.animLoop = function () {
scroolly.onScroll();
scroolly.animFrame = window.requestAnimFrame(scroolly.animLoop);
};
scroolly.init = function (options) {
if (scroolly.isInitialized) {
return false;
}
$.extend(scroolly.options, options);
scroolly.isMobile = scroolly._default(scroolly.options, 'isMobile', (/Android|iPhone|iPad|iPod|BlackBerry/i).test(navigator.userAgent || navigator.vendor || window.opera));
scroolly.detectCSSPrefix();
scroolly.body = $(scroolly.options.body);
window.requestAnimFrame = scroolly.getRAF();
window.cancelAnimFrame = scroolly.getCAF();
scroolly.timesCalled = 0;
$(document).ready(function () {
$(window).resize(scroolly.onResize).resize();
scroolly.animLoop();
});
scroolly.isInitialized = true;
};
scroolly.destroy = function () {
window.cancelAnimFrame(scroolly.animFrame);
};
scroolly.factorySticky = function ($element, params, id) {
id = id || $element[0].tagName + '_' + Object.keys(scroolly.scrollLayout).length;
return scroolly.stickItemXY(id, $element, (params instanceof Array) ? params : [params]) ? id : false;
};
if (patchJQuery) {
$.scroolly = scroolly;
$.fn.scroolly = function (rules, $container, id) {
scroolly.factory(this, rules, $container, id);
return this;
};
$.fn.scroollySticky = function (params, id) {
scroolly.init();
if (!this.length) {
return false;
}
return scroolly.factorySticky(this, params, id);
};
}
return scroolly;
}));