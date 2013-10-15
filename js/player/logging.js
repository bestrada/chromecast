// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Simple logger.
 */

(function() {

  'use strict';

  // Log messages to stdio console.
  var LOG_CONSOLE = true;

  // Log level
  var DLOG_LEVEL = 2;

  var start_time = Date.now();

  function log() {
    if (!LOG_CONSOLE) {
      console.log.apply(console, arguments);
    }

    var t = Math.round(Date.now() - start_time);
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = t + ': ' + vals.join(', ');
    var box = document.getElementById('console');

    if (box) {
      box.value += msg + '\n';
    }

    if (LOG_CONSOLE) {
      console.log(msg);
    }
  }

  function dlog(level) {
    if (level <= DLOG_LEVEL) {
      log.apply(null, arguments);
    }
  }

  // Exports
  window.dlog = dlog;
  window.log = log;
  window.DLOG_LEVEL = DLOG_LEVEL;

})();
