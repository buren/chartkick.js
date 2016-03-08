/*
 * Chartkick.js
 * Create beautiful Javascript charts with minimal code
 * https://github.com/ankane/chartkick.js
 * v1.4.1
 * v1.5.0-buren
 * MIT License
 */

/*jslint browser: true, indent: 2, plusplus: true, vars: true */

(function (window) {
  'use strict';

  var DEFAULT_OPTIONS = {
    lineChart: {
      marker: {
        maxPoints: Infinity
      },
    },
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    days: function() {
      var i;
      var dayNumbers = [];
      for (i = 0; i < 32; i++) {
        dayNumbers.push(i);
      }
      return dayNumbers;
    }
  };

  var config = merge(DEFAULT_OPTIONS, window.Chartkick || {});
  var Chartkick, ISO8601_PATTERN, DECIMAL_SEPARATOR, adapters = [];

  // helpers

  function isArray(variable) {
    return Object.prototype.toString.call(variable) === "[object Array]";
  }

  function isFunction(variable) {
    return variable instanceof Function;
  }

  function isPlainObject(variable) {
    return !isFunction(variable) && variable instanceof Object;
  }

  function isRemoteUrl(dataSource) {
    return typeof dataSource === "string";
  }

  // https://github.com/madrobby/zepto/blob/master/src/zepto.js
  function extend(target, source) {
    var key;
    for (key in source) {
      if (isPlainObject(source[key]) || isArray(source[key])) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key])) {
          target[key] = {};
        }
        if (isArray(source[key]) && !isArray(target[key])) {
          target[key] = [];
        }
        extend(target[key], source[key]);
      } else if (source[key] !== undefined) {
        target[key] = source[key];
      }
    }
  }

  function merge(obj1, obj2) {
    var target = {};
    extend(target, obj1);
    extend(target, obj2);
    return target;
  }

  // https://github.com/Do/iso8601.js
  ISO8601_PATTERN = /(\d\d\d\d)(\-)?(\d\d)(\-)?(\d\d)(T)?(\d\d)(:)?(\d\d)?(:)?(\d\d)?([\.,]\d+)?($|Z|([\+\-])(\d\d)(:)?(\d\d)?)/i;
  DECIMAL_SEPARATOR = String(1.5).charAt(1);

  function parseISO8601(input) {
    var day, hour, matches, milliseconds, minutes, month, offset, result, seconds, type, year;
    type = Object.prototype.toString.call(input);
    if (type === '[object Date]') {
      return input;
    }
    if (type !== '[object String]') {
      return;
    }
    if (matches = input.match(ISO8601_PATTERN)) {
      year = parseInt(matches[1], 10);
      month = parseInt(matches[3], 10) - 1;
      day = parseInt(matches[5], 10);
      hour = parseInt(matches[7], 10);
      minutes = matches[9] ? parseInt(matches[9], 10) : 0;
      seconds = matches[11] ? parseInt(matches[11], 10) : 0;
      milliseconds = matches[12] ? parseFloat(DECIMAL_SEPARATOR + matches[12].slice(1)) * 1000 : 0;
      result = Date.UTC(year, month, day, hour, minutes, seconds, milliseconds);
      if (matches[13] && matches[14]) {
        offset = matches[15] * 60;
        if (matches[17]) {
          offset += parseInt(matches[17], 10);
        }
        offset *= matches[14] === '-' ? -1 : 1;
        result -= offset * 60 * 1000;
      }
      return new Date(result);
    }
  }
  // end iso8601.js

  function negativeValues(series) {
    var i, j, data;
    for (i = 0; i < series.length; i++) {
      data = series[i].data;
      for (j = 0; j < data.length; j++) {
        if (data[j][1] < 0) {
          return true;
        }
      }
    }
    return false;
  }

  function jsOptionsFunc(defaultOptions, hideLegend, setMin, setMax, setStacked, setXtitle, setYtitle) {
    return function (series, opts, chartOptions) {
      var options = merge({}, defaultOptions);
      options = merge(options, chartOptions || {});

      // hide legend
      // this is *not* an external option!
      if (opts.hideLegend) {
        hideLegend(options);
      }

      // min
      if ("min" in opts) {
        setMin(options, opts.min);
      } else if (!negativeValues(series)) {
        setMin(options, 0);
      }

      // max
      if (opts.max) {
        setMax(options, opts.max);
      }

      if ("stacked" in opts) {
        setStacked(options);
      }

      if ("colors" in opts) {
        options.colors = opts.colors;
      }

      if (opts.dateFormat) {
        options.dateFormat = opts.dateFormat;
      }

      if (opts.xtitle) {
        setXtitle(options, opts.xtitle);
      }

      if (opts.ytitle) {
        setYtitle(options, opts.ytitle);
      }

      // merge library last
      options = merge(options, opts.library || {});

      return options;
    };
  }

  function setText(element, text) {
    if (document.body.innerText) {
      element.innerText = text;
    } else {
      element.textContent = text;
    }
  }

  function chartError(element, message) {
    setText(element, "Error Loading Chart: " + message);
    element.style.color = "#ff0000";
  }

  function getJSON(element, url, success) {
    var $ = window.jQuery || window.Zepto || window.$;
    $.ajax({
      dataType: "json",
      url: url,
      success: success,
      error: function (jqXHR, textStatus, errorThrown) {
        var message = (typeof errorThrown === "string") ? errorThrown : errorThrown.message;
        chartError(element, message);
      }
    });
  }

  function errorCatcher(chart, callback) {
    try {
      callback(chart);
    } catch (err) {
      chartError(chart.element, err.message);
      throw err;
    }
  }

  function fetchDataSource(chart, callback) {
    if (isRemoteUrl(chart.dataSource)) {
      getJSON(chart.element, chart.dataSource, function (data, textStatus, jqXHR) {
        chart.data = data;
        errorCatcher(chart, callback);
      });
    } else {
      chart.data = chart.dataSource;
      errorCatcher(chart, callback);
    }
  }

  // type conversions

  function toStr(n) {
    return "" + n;
  }

  function toFloat(n) {
    return parseFloat(n);
  }

  function toDate(n) {
    if (typeof n !== "object") {
      if (typeof n === "number") {
        n = new Date(n * 1000); // ms
      } else { // str
        // try our best to get the str into iso8601
        // TODO be smarter about this
        var str = n.replace(/ /, "T").replace(" ", "").replace("UTC", "Z");
        n = parseISO8601(str) || new Date(n);
      }
    }
    return n;
  }

  function toArr(n) {
    if (!isArray(n)) {
      var arr = [], i;
      for (i in n) {
        if (n.hasOwnProperty(i)) {
          arr.push([i, n[i]]);
        }
      }
      n = arr;
    }
    return n;
  }

  function sortByTime(a, b) {
    return a[0].getTime() - b[0].getTime();
  }

  if ("Highcharts" in window) {
    var HighchartsAdapter = new function () {
      var Highcharts = window.Highcharts;

      this.name = "highcharts";

      var defaultOptions = {
        chart: {},
        xAxis: {
          title: {
            text: null
          },
          labels: {
            style: {
              fontSize: "12px"
            }
          }
        },
        yAxis: {
          title: {
            text: null
          },
          labels: {
            style: {
              fontSize: "12px"
            }
          }
        },
        title: {
          text: null
        },
        credits: {
          enabled: false
        },
        legend: {
          borderWidth: 0
        },
        tooltip: {
          style: {
            fontSize: "12px"
          }
        },
        plotOptions: {
          areaspline: {},
          series: {
            marker: {}
          }
        }
      };

      var hideLegend = function (options) {
        options.legend.enabled = false;
      };

      var setMin = function (options, min) {
        options.yAxis.min = min;
      };

      var setMax = function (options, max) {
        options.yAxis.max = max;
      };

      var setStacked = function (options) {
        options.plotOptions.series.stacking = "normal";
      };

      var setXtitle = function (options, title) {
        options.xAxis.title.text = title;
      };

      var setYtitle = function (options, title) {
        options.yAxis.title.text = title;
      };

      var jsOptions = jsOptionsFunc(defaultOptions, hideLegend, setMin, setMax, setStacked, setXtitle, setYtitle);

      this.renderLineChart = function (chart, chartType) {
        chartType = chartType || "spline";
        var chartOptions = {};
        if (chartType === "areaspline") {
          chartOptions = {
            plotOptions: {
              areaspline: {
                stacking: "normal"
              },
              series: {
                marker: {
                  enabled: false
                }
              }
            }
          };
        }
        var options = jsOptions(chart.data, chart.options, chartOptions), data, i, j;
        options.xAxis.type = chart.options.discrete ? "category" : "datetime";
        options.chart.type = chartType;
        options.chart.renderTo = chart.element.id;

        if (options.dateFormat) {
          options.xAxis.labels.formatter = function () {
            return Highcharts.dateFormat(options.dateFormat, this.value);
          };
        }

        var series = chart.data;
        var maxMarkerPoints;
        for (i = 0; i < series.length; i++) {
          data = series[i].data;
          if (!chart.options.discrete) {
            for (j = 0; j < data.length; j++) {
              data[j][0] = data[j][0].getTime();
            }
          }
          maxMarkerPoints = series[i].maxMarkerPoints || chart.options.maxMarkerPoints || config.lineChart.marker.maxPoints;
          series[i].marker = {
            symbol: series[i].marker || "circle",
            enabled: maxMarkerPoints >= data.length // Don't display markers if there are too many data points
          };
        }
        options.series = series;
        new Highcharts.Chart(options);
      };

      this.renderScatterChart = function (chart) {
        var chartOptions = {};
        var options = jsOptions(chart.data, chart.options, chartOptions);
        options.chart.type = 'scatter';
        options.chart.renderTo = chart.element.id;
        options.series = chart.data;
        new Highcharts.Chart(options);
      };

      var buildHeatmapYcategories = function(groupBy) {
        var categories;
        if (groupBy === "weekdays") {
          categories = config.weekdays;
        } else if (groupBy === "months") {
          categories = config.months;
        } else if (groupBy === "days") {
          categories = config.days;
        }
        return categories;
      };

      var getHeatmapChartOptions = function(xcategories, ycategories) {
        return {
          colorAxis: {
            min: 0
          }, tooltip: {
            formatter: function () {
              var yPoint = this.series.yAxis.categories[this.point.y];
              var xPoint = this.series.xAxis.categories[this.point.x] || "Value";
              var label = "";
              if (yPoint) {
                label += "<b>" + yPoint + "</b><br>";
              }
              label += "<b>" + xPoint + "</b>: <b>" + this.point.value + "</b>"
              return label;
            }
          },
          yAxis: { categories: ycategories },
          xAxis: { categories: xcategories }
        };
      };

      var buildHeatmapXcategories = function(chartData) {
        var categories = [];
        for (var i = 0; i < chartData.length; i++) {
          categories.push(chartData[i].name);
        }
        return categories;
      };

      this.renderHeatmap = function (chart) {
        var groupBy = chart.options.groupBy;
        var ycategories = chart.options.ycategories || buildHeatmapYcategories(groupBy);
        var xcategories = chart.options.xcategories || buildHeatmapXcategories(chart.data);

        var chartOptions = getHeatmapChartOptions(xcategories, ycategories);
        var options = jsOptions(chart.data, chart.options, chartOptions);
        options.chart.type = "heatmap";
        options.chart.renderTo = chart.element.id;
        options.series = chart.data;
        new Highcharts.Chart(options);
      };

      this.renderPieChart = function (chart) {
        var chartOptions = {};
        if (chart.options.colors) {
          chartOptions.colors = chart.options.colors;
        }
        var options = merge(merge(defaultOptions, chartOptions), chart.options.library || {});
        options.chart.renderTo = chart.element.id;
        options.series = [{
          type: "pie",
          name: "Value",
          data: chart.data
        }];
        new Highcharts.Chart(options);
      };

      this.renderColumnChart = function (chart, chartType) {
        var chartType = chartType || "column";
        var series = chart.data;
        var options = jsOptions(series, chart.options), i, j, s, d, rows = [];
        options.chart.type = chartType;
        options.chart.renderTo = chart.element.id;

        for (i = 0; i < series.length; i++) {
          s = series[i];

          for (j = 0; j < s.data.length; j++) {
            d = s.data[j];
            if (!rows[d[0]]) {
              rows[d[0]] = new Array(series.length);
            }
            rows[d[0]][i] = d[1];
          }
        }

        var categories = [];
        for (i in rows) {
          if (rows.hasOwnProperty(i)) {
            categories.push(i);
          }
        }
        options.xAxis.categories = categories;

        var newSeries = [];
        for (i = 0; i < series.length; i++) {
          d = [];
          for (j = 0; j < categories.length; j++) {
            d.push(rows[categories[j]][i] || 0);
          }

          newSeries.push({
            name: series[i].name,
            data: d
          });
        }
        options.series = newSeries;

        new Highcharts.Chart(options);
      };

      this.renderComboChart = function (chart, chartType) {
        var chartType = chartType || "column";
        var series = chart.data;
        var types = chart.options.types;
        var options = jsOptions(series, chart.options), i, j, s, d, rows = [];
        // options.chart.type = chartType;
        options.chart.renderTo = chart.element.id;

        for (i = 0; i < series.length; i++) {
          s = series[i];

          for (j = 0; j < s.data.length; j++) {
            d = s.data[j];
            if (!rows[d[0]]) {
              rows[d[0]] = new Array(series.length);
            }
            rows[d[0]][i] = d[1];
          }
        }

        var categories = [];
        for (i in rows) {
          if (rows.hasOwnProperty(i)) {
            categories.push(i);
          }
        }
        options.xAxis.categories = categories;

        var newSeries = [];
        for (i = 0; i < series.length; i++) {
          d = [];
          for (j = 0; j < categories.length; j++) {
            d.push(rows[categories[j]][i] || 0);
          }

          newSeries.push({
            name: series[i].name,
            data: d,
            type: types[i]
          });
        }
        options.series = newSeries;

        new Highcharts.Chart(options);
      };

      var self = this;

      this.renderBarChart = function (chart) {
        self.renderColumnChart(chart, "bar");
      };

      this.renderAreaChart = function (chart) {
        self.renderLineChart(chart, "areaspline");
      };
    };
    adapters.push(HighchartsAdapter);
  }
  if (window.google && window.google.setOnLoadCallback) {
    var GoogleChartsAdapter = new function () {
      var google = window.google;

      this.name = "google";

      var loaded = {};
      var callbacks = [];

      var runCallbacks = function () {
        var cb, call;
        for (var i = 0; i < callbacks.length; i++) {
          cb = callbacks[i];
          call = google.visualization && ((cb.pack === "corechart" && google.visualization.LineChart) || (cb.pack === "timeline" && google.visualization.Timeline) || (cb.pack === "calendar" && google.visualization.Calendar) || (cb.pack === "gauge" && google.visualization.Gauge))
          if (call) {
            cb.callback();
            callbacks.splice(i, 1);
            i--;
          }
        }
      };

      var waitForLoaded = function (pack, callback) {
        if (!callback) {
          callback = pack;
          pack = "corechart";
        }

        callbacks.push({pack: pack, callback: callback});

        if (loaded[pack]) {
          runCallbacks();
        } else {
          loaded[pack] = true;

          // https://groups.google.com/forum/#!topic/google-visualization-api/fMKJcyA2yyI
          var loadOptions = {
            packages: [pack],
            callback: runCallbacks
          };
          if (config.language) {
            loadOptions.language = config.language;
          }
          google.load("visualization", "1", loadOptions);
        }
      };

      // Set chart options
      var defaultOptions = {
        chartArea: {},
        fontName: "'Lucida Grande', 'Lucida Sans Unicode', Verdana, Arial, Helvetica, sans-serif",
        pointSize: 6,
        legend: {
          textStyle: {
            fontSize: 12,
            color: "#444"
          },
          alignment: "center",
          position: "right"
        },
        curveType: "function",
        hAxis: {
          textStyle: {
            color: "#666",
            fontSize: 12
          },
          titleTextStyle: {},
          gridlines: {
            color: "transparent"
          },
          baselineColor: "#ccc",
          viewWindow: {}
        },
        vAxis: {
          textStyle: {
            color: "#666",
            fontSize: 12
          },
          titleTextStyle: {},
          baselineColor: "#ccc",
          viewWindow: {}
        },
        tooltip: {
          textStyle: {
            color: "#666",
            fontSize: 12
          }
        }
      };

      var hideLegend = function (options) {
        options.legend.position = "none";
      };

      var setMin = function (options, min) {
        options.vAxis.viewWindow.min = min;
      };

      var setMax = function (options, max) {
        options.vAxis.viewWindow.max = max;
      };

      var setBarMin = function (options, min) {
        options.hAxis.viewWindow.min = min;
      };

      var setBarMax = function (options, max) {
        options.hAxis.viewWindow.max = max;
      };

      var setStacked = function (options) {
        options.isStacked = true;
      };

      var setXtitle = function (options, title) {
        options.hAxis.title = title;
        options.hAxis.titleTextStyle.italic = false;
      }

      var setYtitle = function (options, title) {
        options.vAxis.title = title;
        options.vAxis.titleTextStyle.italic = false;
      };

      var jsOptions = jsOptionsFunc(defaultOptions, hideLegend, setMin, setMax, setStacked, setXtitle, setYtitle);

      // cant use object as key
      var createDataTable = function (series, columnType) {
        var data = new google.visualization.DataTable();
        data.addColumn(columnType, "");

        var i, j, s, d, key, rows = [];
        for (i = 0; i < series.length; i++) {
          s = series[i];
          data.addColumn("number", s.name);

          for (j = 0; j < s.data.length; j++) {
            d = s.data[j];
            key = (columnType === "datetime") ? d[0].getTime() : d[0];
            if (!rows[key]) {
              rows[key] = new Array(series.length);
            }
            rows[key][i] = toFloat(d[1]);
          }
        }

        var rows2 = [];
        var value;
        for (i in rows) {
          if (rows.hasOwnProperty(i)) {
            if (columnType === "datetime") {
              value = new Date(toFloat(i));
            } else if (columnType === "number") {
              value = toFloat(i);
            } else {
              value = i;
            }
            rows2.push([value].concat(rows[i]));
          }
        }
        if (columnType === "datetime") {
          rows2.sort(sortByTime);
        }
        data.addRows(rows2);

        return data;
      };

      var oneTimeEvent = function (node, type, callback) {
        node.addEventListener(type, function(e) {
          e.target.removeEventListener(e.type, arguments.callee);
          return callback(e);
        });
      }

      var resize = function (callback) {
        if (window.attachEvent) {
          oneTimeEvent(window, 'onresize', callback)
        } else if (window.addEventListener) {
          window.addEventListener("resize", callback, true);
        }
        callback();
      };

      this.renderLineChart = function (chart) {
        waitForLoaded(function () {
          var options = jsOptions(chart.data, chart.options);
          var data = createDataTable(chart.data, chart.options.discrete ? "string" : "datetime");
          // Date formatting wont work if chart discrete options set to true
          if (options.dateFormat) {
            var formatter = new google.visualization.DateFormat({
              pattern: options.dateFormat
            });
            formatter.format(data, 0);
            options.hAxis.format = options.dateFormat;
          }
          var maxMarkerPoints = chart.options.maxMarkerPoints || config.lineChart.marker.maxPoints;
          // Don't display markers if there are too many data points
          var enabled = maxMarkerPoints >= data.getNumberOfRows();
          if (!enabled) {
            options.pointSize = 0;
          }

          chart.chart = new google.visualization.LineChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderPieChart = function (chart) {
        waitForLoaded(function () {
          var chartOptions = {
            chartArea: {
              top: "10%",
              height: "80%"
            }
          };
          if (chart.options.colors) {
            chartOptions.colors = chart.options.colors;
          }
          var options = merge(merge(defaultOptions, chartOptions), chart.options.library || {});

          var data = new google.visualization.DataTable();
          data.addColumn("string", "");
          data.addColumn("number", "Value");
          data.addRows(chart.data);

          chart.chart = new google.visualization.PieChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderColumnChart = function (chart) {
        waitForLoaded(function () {
          var options = jsOptions(chart.data, chart.options);
          var data = createDataTable(chart.data, "string");
          chart.chart = new google.visualization.ColumnChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderComboChart = function (chart) {
        waitForLoaded(function () {
          var i, type, seriesOptions = [];
          var types = chart.options.types;

          for (i = 0; i < types.length; i++) {
            type = types[i];
            if(type == "column"){
              type = "bars";
            }
            seriesOptions.push({type: type});
          }
          var chartOptions = {
            series: seriesOptions
          };
          var options = jsOptionsFunc(defaultOptions, hideLegend, setBarMin, setBarMax, setStacked)(chart.data, chart.options, chartOptions);
          var data = createDataTable(chart.data, "string");
          chart.chart = new google.visualization.ComboChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderBarChart = function (chart) {
        waitForLoaded(function () {
          var chartOptions = {
            hAxis: {
              gridlines: {
                color: "#ccc"
              }
            }
          };
          var options = jsOptionsFunc(defaultOptions, hideLegend, setBarMin, setBarMax, setStacked)(chart.data, chart.options, chartOptions);
          var data = createDataTable(chart.data, "string");
          chart.chart = new google.visualization.BarChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderAreaChart = function (chart) {
        waitForLoaded(function () {
          var chartOptions = {
            isStacked: true,
            pointSize: 0,
            areaOpacity: 0.5
          };
          var options = jsOptions(chart.data, chart.options, chartOptions);
          var data = createDataTable(chart.data, chart.options.discrete ? "string" : "datetime");
          chart.chart = new google.visualization.AreaChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderGauge = function (chart) {
        waitForLoaded("gauge", function () {
          var chartOptions = {
            legend: "none",
            colorAxis: {
              colors: chart.options.colors || ["#f6c7b6", "#ce502d"]
            }
          };
          var options = merge(merge(defaultOptions, chartOptions), merge(chart.options.library || {},chart.options || {}));
          var data = google.visualization.arrayToDataTable(chart.data);
          if (chart.options.money) {
            var formatter = new google.visualization.NumberFormat({pattern: '$###,###'});
            formatter.format(data, 1);
          }else if (chart.options.percentage){
            var formatter = new google.visualization.NumberFormat({pattern: '###%'});
            formatter.format(data, 1);
          }

          chart.chart = new google.visualization.Gauge(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderGeoChart = function (chart) {
        waitForLoaded(function () {
          var chartOptions = {
            legend: "none",
            colorAxis: {
              colors: chart.options.colors || ["#f6c7b6", "#ce502d"]
            }
          };
          var options = merge(merge(defaultOptions, chartOptions), chart.options.library || {});

          var data = new google.visualization.DataTable();
          data.addColumn("string", "");
          data.addColumn("number", chart.options.valueLabel || "Value");
          data.addRows(chart.data);

          chart.chart = new google.visualization.GeoChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderScatterChart = function (chart) {
        waitForLoaded(function () {
          var chartOptions = {};
          var options = jsOptions(chart.data, chart.options, chartOptions);
          var data = createDataTable(chart.data, "number");

          chart.chart = new google.visualization.ScatterChart(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderTimeline = function (chart) {
        waitForLoaded("timeline", function () {
          var chartOptions = {
            legend: "none"
          };

          if (chart.options.colors) {
            chartOptions.colors = chart.options.colors;
          }
          var options = merge(merge(defaultOptions, chartOptions), chart.options.library || {});

          var data = new google.visualization.DataTable();
          data.addColumn({type: "string", id: "Name"});
          data.addColumn({type: "date", id: "Start"});
          data.addColumn({type: "date", id: "End"});
          data.addRows(chart.data);

          chart.chart = new google.visualization.Timeline(chart.element);

          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };

      this.renderCalendar = function (chart) {
        waitForLoaded("calendar", function () {
          var chartOptions = {};
          var options = merge(merge(defaultOptions, chartOptions), chart.options.library || {});

          var data = new google.visualization.DataTable();
          data.addColumn({ type: "date", id: "Date" });
          data.addColumn({ type: "number", id: "Value" });
          data.addRows(chart.data);

          chart.chart = new google.visualization.Calendar(chart.element);
          resize(function () {
            chart.chart.draw(data, options);
          });
        });
      };
    };

    adapters.push(GoogleChartsAdapter);
  }

  // TODO remove chartType if cross-browser way
  // to get the name of the chart class
  function renderChart(chartType, chart) {
    var i, adapter, fnName, adapterName;
    fnName = "render" + chartType;
    adapterName = chart.options.adapter;

    for (i = 0; i < adapters.length; i++) {
      adapter = adapters[i];
      if ((!adapterName || adapterName === adapter.name) && isFunction(adapter[fnName])) {
        return adapter[fnName](chart);
      }
    }
    throw new Error("No adapter found");
  }

  // process data

  var toFormattedKey = function (key, keyType) {
    if (keyType === "number") {
      key = toFloat(key);
    } else if (keyType === "datetime") {
      key = toDate(key);
    } else {
      key = toStr(key);
    }
    return key;
  };

  var formatSeriesData = function (data, keyType) {
    var r = [], key, j;
    for (j = 0; j < data.length; j++) {
      key = toFormattedKey(data[j][0], keyType);
      r.push([key, toFloat(data[j][1])]);
    }
    if (keyType === "datetime") {
      r.sort(sortByTime);
    }
    return r;
  };

  var normalizeSeries = function (series, opts) {
    if (!isArray(series) || typeof series[0] !== "object" || isArray(series[0])) {
      series = [{name: "Value", data: series}];
      opts.hideLegend = true;
    } else {
      opts.hideLegend = false;
    }
    return series;
  };

  function processSeries(series, opts, keyType) {
    var i;

    // see if one series or multiple
    series = normalizeSeries(series, opts);

    if (opts.discrete) {
      keyType = "string";
    }

    // right format
    for (i = 0; i < series.length; i++) {
      series[i].data = formatSeriesData(toArr(series[i].data), keyType);
    }

    return series;
  }

  function processSimple(data, header) {
    var perfectData = toArr(data), i;

    for (i = 0; i < perfectData.length; i++) {
      perfectData[i] = [toStr(perfectData[i][0]), toFloat(perfectData[i][1])];
    }
    if (header) {
      perfectData = [["Label", "Value"]].concat(perfectData);
    }
    return perfectData;
  }

  function processTime(data)
  {
    var i;
    for (i = 0; i < data.length; i++) {
      data[i][1] = toDate(data[i][1]);
      data[i][2] = toDate(data[i][2]);
    }
    return data;
  }

  function processHeatmap(series, opts) {
    var i, j, data, point, yvalue;
    var groupBy = opts.groupBy;
    series = normalizeSeries(series, opts);
    for (i = 0; i < series.length; i++) {
      data = series[i].data;
      for (j = 0; j < data.length; j++) {
        if (groupBy) {
          point = data[j];
          yvalue = toDate(point[0]);
          if (groupBy === "weekdays") {
            yvalue = yvalue.getDay();
          } else if (groupBy === "months") {
            yvalue = yvalue.getMonth();
          } else if (groupBy === "days") {
            yvalue = yvalue.getDate();
          }
          data[j] = [i, yvalue, point[1]];
        }
      }
      series[i].dataLabels = { enabled: true };
    }
    return series;
  }

  function processCalendar(data) {
    var i;
    for (i = 0; i < data.length; i++) {
      data[i][0] = toDate(data[i][0]);
    }
    return data;
  }

  function processLineData(chart) {
    chart.data = processSeries(chart.data, chart.options, "datetime");
    renderChart("LineChart", chart);
  }

  function processColumnData(chart) {
    chart.data = processSeries(chart.data, chart.options, "string");
    renderChart("ColumnChart", chart);
  }

  function processComboData(chart) {
    chart.data = processSeries(chart.data, chart.options, false);
    renderChart("ComboChart", chart);
  }

  function processPieData(chart) {
    chart.data = processSimple(chart.data);
    renderChart("PieChart", chart);
  }

  function processBarData(chart) {
    chart.data = processSeries(chart.data, chart.options, "string");
    renderChart("BarChart", chart);
  }

  function processAreaData(chart) {
    chart.data = processSeries(chart.data, chart.options, "datetime");
    renderChart("AreaChart", chart);
  }

  function processGaugeData(chart) {
   chart.data = processSimple(chart.data, true);
   renderChart("Gauge", chart);
  }

  function processGeoData(chart) {
    chart.data = processSimple(chart.data);
    renderChart("GeoChart", chart);
  }

  function processScatterData(chart) {
    chart.data = processSeries(chart.data, chart.options, "number");
    renderChart("ScatterChart", chart);
  }

  function processCalendarData(chart) {
    chart.data = processCalendar(chart.data);
    renderChart("Calendar", chart);
  }

  function processTimelineData(chart) {
    chart.data = processTime(chart.data);
    renderChart("Timeline", chart);
  }

  function Repeater(callback, timeout) {
    var self = this;
    var update = callback;

    self.runner = setInterval(function () { update(); }, timeout);
    self.stop = function () { clearInterval(self.runner); };
  }

  function processHeatmapData(chart) {
    chart.data = processHeatmap(chart.data, chart.options);
    renderChart("Heatmap", chart);
  }

  function setElement(chart, element, dataSource, opts, callback) {
    if (typeof element === "string") {
      element = document.getElementById(element);
    }
    chart.element = element;
    chart.options = opts || {};
    chart.dataSource = dataSource;
    Chartkick.charts[element.id] = chart;
    fetchDataSource(chart, callback);

    Chartkick.setRefresh(element.id, chart.options.refresh);
  }

  // define classes

  Chartkick = {
    LineChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processLineData);
    },
    PieChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processPieData);
    },
    ColumnChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processColumnData);
    },
    BarChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processBarData);
    },
    ComboChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processComboData);
    },
    AreaChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processAreaData);
    },
    GeoChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processGeoData);
    },
    ScatterChart: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processScatterData);
    },
    Gauge: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processGaugeData);
    },
    Timeline: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processTimelineData);
    },
    Calendar: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processCalendarData);
    },
    Heatmap: function (element, dataSource, opts) {
      setElement(this, element, dataSource, opts, processHeatmapData);
    },
    charts: {},
    repeaters: {},
    setRefresh: function(chartId, refreshInterval) {
      if (refreshInterval && !Chartkick.repeaters[chartId]) {
        Chartkick.repeaters[chartId] = new Repeater(function() {
          Chartkick.updateChart(chartId);
        }, refreshInterval);
      }
    },
    stopRefresh: function(chartId) {
      Chartkick.repeaters[chartId].stop();
      Chartkick.repeaters[chartId] = null;
    },
    charts: {},
    updateChart: function(chartId, dataSource, opts) {
      var chart = Chartkick.charts[chartId];
      var options;
      var source;
      if (chart === undefined) {
        throw new Error("No chart found with id: " + chartId);
      }

      source = dataSource || chart.dataSource;
      options = opts ? merge(chart.options, opts) : chart.options;

      new chart.__proto__.constructor(chart.element.id, source, options);
    },
    updateAllCharts: function(callback) {
      var charts = Chartkick.charts;
      var chart;
      var isRemote;
      var chartProps;

      var setChartProps = function(obj) {
        var data = obj.data;
        var opts = obj.options || {};

        // If there is no data and options properties assume that obj is the data
        if (!data && !opts) {
          data = obj;
        }

        return {
          options: opts,
          data: data
        };
      }

      for (var chartId in charts) {
        chart = charts[chartId];
        isRemote = isRemoteUrl(chart.dataSource);
        if (isFunction(callback)) {
          chartProps = setChartProps(callback(chart, isRemote));
          Chartkick.updateChart(chartId, chartProps.data, chartProps.options);
        } else if (isRemote) {
          Chartkick.updateChart(chartId, chart.dataSource);
        }
      }
    }
  };

  window.Chartkick = Chartkick;
}(window));
