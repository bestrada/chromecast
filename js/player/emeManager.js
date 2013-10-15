// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Manages the DRM license requests.
 */

(function() {

  'use strict';

  var EMEManager = function(video) {
    this.video = video;

    if (!video.generateKeyRequest && video.webkitGenerateKeyRequest) {
      video.generateKeyRequest = video.webkitGenerateKeyRequest;
    }

    if (!video.addKey && video.webkitAddKey) {
      video.addKey = video.webkitAddKey;
    }

    if (!video.generateKeyRequest || !video.addKey) {
      throw new Error(
          'Unsupported browser: Encrypted Media Extensions required');
    }

    this.initDataQueue = [];

    this.flavor = null;
    this.keySystem = null;
    this.licenseServerURL = null;
    video.addEventListener('needkey', this.onNeedKey.bind(this));
    video.addEventListener('keymessage', this.onKeyMessage.bind(this));
    video.addEventListener('keyerror', this.onKeyError.bind(this));
    video.addEventListener('webkitneedkey', this.onNeedKey.bind(this));
    video.addEventListener('webkitkeymessage', this.onKeyMessage.bind(this));
    video.addEventListener('webkitkeyerror', this.onKeyError.bind(this));
  };

  // Assumes avc1 for the canPlayType query
  EMEManager.kMime = 'video/mp4; codecs="avc1.640028"';

  EMEManager.kFlavorToSystem = {
    'clearkey': ['webkit-org.w3.clearkey', 'org.w3.clearkey'],
    'widevine': ['com.widevine.alpha'],
    'playready': ['com.youtube.playready', 'com.microsoft.playready']
  };

  EMEManager.prototype.init = function(flavorMap, opt_flavor, video) {
    this.chooseFlavor(EMEManager.kMime, flavorMap, opt_flavor);
    this.isClearKey = this.flavor == 'clearkey';
  };

  EMEManager.prototype.chooseFlavor = function(mime, flavorMap, opt_flavor) {
    for (var flavor in flavorMap) {
      if (opt_flavor && flavor != opt_flavor) continue;
      var systems = EMEManager.kFlavorToSystem[flavor];
      if (!systems) continue;
      for (var i in systems) {
        if (this.video.canPlayType(mime, systems[i])) {
          this.flavor = flavor;
          this.keySystem = systems[i];
          this.licenseServerURL = flavorMap[flavor];
          return;
        }
      }
    }
    throw 'Could not find a compatible key system';
  };

  EMEManager.prototype.extractBMFFClearKeyID = function(initData) {
    // It is not possible to access the Uint8Array's underlying ArrayBuffer, copy it
    // to a new one for parsing.
    var abuf = new ArrayBuffer(initData.length);
    var view = new Uint8Array(abuf);
    view.set(initData);

    var dv = new DataView(abuf);
    var pos = 0;
    while (pos < abuf.byteLength) {
      var box_size = dv.getUint32(pos, false);
      var type = dv.getUint32(pos + 4, false);

      if (type != 0x70737368)
        throw 'Box type ' + type.toString(16) + ' not equal to "pssh"';

      // Scan for Clear Key header
      if ((dv.getUint32(pos + 12, false) == 0x58147ec8) &&
          (dv.getUint32(pos + 16, false) == 0x04234659) &&
          (dv.getUint32(pos + 20, false) == 0x92e6f52c) &&
          (dv.getUint32(pos + 24, false) == 0x5ce8c3cc)) {
        var size = dv.getUint32(pos + 28, false);
        if (size != 16) throw 'Unexpected KID size ' + size;
        return new Uint8Array(abuf.slice(pos + 32, pos + 32 + size));
      }

      // Failing that, scan for Widevine protobuf header
      if ((dv.getUint32(pos + 12, false) == 0xedef8ba9) &&
          (dv.getUint32(pos + 16, false) == 0x79d64ace) &&
          (dv.getUint32(pos + 20, false) == 0xa3c827dc) &&
          (dv.getUint32(pos + 24, false) == 0xd51d21ed)) {
        return new Uint8Array(abuf.slice(pos + 36, pos + 52));
      }
      pos += box_size;
    }

    // Not found
    return initData;
  };

  EMEManager.prototype.onNeedKey = function(e) {
    dlog(2, 'onNeedKey()');
    if (!this.keySystem)
      throw 'Not initialized! Bad manifest parse?';
    if (e.initData.length == 16) {
      log('Dropping non-BMFF needKey event');
      return;
    }

    var initData = e.initData;
    if (this.isClearKey) {
      initData = this.extractBMFFClearKeyID(e.initData);
    }
    this.video.generateKeyRequest(this.keySystem, initData);
    this.initDataQueue.push(initData);
  };

  EMEManager.prototype.onKeyMessage = function(e) {
    dlog(2, 'onKeyMessage() Sending request: ' +
        this.licenseServerURL + ' ' + e.sessionId);
    var initData = this.initDataQueue.shift();
    var xhr = new XMLHttpRequest();
    xhr.open('POST', this.licenseServerURL);
    xhr.setRequestHeader('content-type', 'text/xml;charset=utf-8');
    xhr.addEventListener('load', this.onLoad.bind(this, initData, e.sessionId));
    xhr.responseType = 'arraybuffer';
    xhr.send(e.message);
  };

  EMEManager.prototype.onKeyError = function(e) {
    dlog(2, 'onKeyError(' + e.keySystem + ', ' +
        e.errorCode.code + ', ' + e.systemCode + ')');
  };

  function stringToArray(s) {
    var array = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
      array[i] = s.charCodeAt(i);
    }
    return array;
  }

  function arrayToString(a) {
    return String.fromCharCode.apply(String, a);
  }

  EMEManager.prototype.onLoad = function(initData, sessionId, e) {
    dlog(2, 'onLoad(' + this.licenseServerURL + '): ' + sessionId);
    if (e.target.status < 200 || e.target.status > 299) {
      throw 'Bad XHR status: ' + e.target.statusText;
    }

    // Parse "GLS/1.0 0 OK\r\nHeader: Value\r\n\r\n<xml>HERE BE SOAP</xml>
    var responseString =
        arrayToString(new Uint8Array(e.target.response)).split('\r\n').pop();
    var test =
        this.video.addKey(
        this.keySystem, stringToArray(responseString), initData, sessionId);
  };

  window.EMEManager = EMEManager;

})();
