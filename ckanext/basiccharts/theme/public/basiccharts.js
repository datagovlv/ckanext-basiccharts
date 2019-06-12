this.ckan = this.ckan || {};
this.ckan.views = this.ckan.views || {};
this.ckan.views.basiccharts = this.ckan.views.basiccharts || {};

(function(self, $) {
  "use strict";

  var parsers = {
        integer: parseInt,
        numeric: parseFloat,
        text: function (x) {
          return x;
        },
        timestamp: function (x) {
          return new Date(x).getTime();
        }
      };

  self.init = function init(elementId, _resource, _params, sortData) {
    initPlot(elementId, sortData, _resource, _params);
  };

  self.redrawGraph = function (){
    var elementId = ckan.views.basiccharts.actualElementId;
    var data = ckan.views.basiccharts.actualData;
    var params = ckan.views.basiccharts.actualParams;
    var fields = ckan.views.basiccharts.actualFields;

    var definedWidth = params.width ? params.width : null;
    var definedHeight = params.height ? params.height : null;
    var width = definedWidth != null ? definedWidth : ($(elementId).find("svg").length > 0 ? $(elementId).find("svg").innerWidth() : $(elementId).innerWidth());
    var height = definedHeight != null ? definedHeight : ($(elementId).find("svg").length > 0 ? $(elementId).find("svg").innerHeight() : $(elementId).innerHeight());
    var definedColor = params.color ? params.color : "interpolateRainbow";

    switch(ckan.views.basiccharts.actualType)
    {
      case "hexbin":
        var radius = 8;
        var margin = ({top: 20, right: 20, bottom: 30, left: 40});
        var svg = d3.select($(elementId)[0]).append("svg");

        svg.attr("width", width)
           .attr("height", height);

        var x = d3.scaleLog()
          .domain(d3.extent(data, d => d[0]))
          .range([margin.left, width - margin.right]);

        var y = d3.scaleLog()
          .domain(d3.extent(data, d => d[1]))
          .rangeRound([height - margin.bottom, margin.top]);

        var hexbin = d3.hexbin()
          .x(d => x(d[0]))
          .y(d => y(d[1]))
          .radius(radius * width / 964)
          .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

        var bins = hexbin(data);

        var color = d3.scaleSequential(d3[definedColor])
          .domain([0, d3.max(bins, d => d.length) / 2]);

        var xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 80, ""))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", width - margin.right)
            .attr("y", -4)
            .attr("fill", "currentColor")
            .attr("font-weight", "bold")
            .attr("text-anchor", "end")
            .text(params.x_axis));

        var yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(null, ".1s"))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", 4)
            .attr("y", margin.top)
            .attr("dy", ".71em")
            .attr("fill", "currentColor")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .text(params.y_axis));

        svg.append("g")
          .call(xAxis);

        svg.append("g")
          .call(yAxis);

        svg.append("g")
          .attr("stroke", "#000")
          .attr("stroke-opacity", 0.1)
        .selectAll("path")
        .data(bins)
        .enter().append("path")
          .attr("d", hexbin.hexagon())
          .attr("transform", d => `translate(${d.x},${d.y})`)
          .attr("fill", d => color(d.length));

        break;
      case "boxplot":
        var svg = d3.select($(elementId)[0]).append("svg");
        var margin = ({top: 20, right: 20, bottom: 30, left: 40});
        var n = width / 40;

        svg.attr("width", width)
           .attr("height", height);

        var yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(null, "s"))
        .call(g => g.select(".domain").remove());

        var xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(n).tickSizeOuter(0));

        var bins = d3.histogram()
          .thresholds(n)
          .value(d => d[0])
        (data)
          .map(bin => {
            bin.sort((a, b) => a[1] - b[1]);
            var values = bin.map(d => d[1]);
            var min = values[0];
            var max = values[values.length - 1];
            var q1 = d3.quantile(values, 0.25);
            var q2 = d3.quantile(values, 0.50);
            var q3 = d3.quantile(values, 0.75);
            var iqr = q3 - q1; // interquartile range
            var r0 = Math.max(min, q1 - iqr * 1.5);
            var r1 = Math.min(max, q3 + iqr * 1.5);
            bin.quartiles = [q1, q2, q3];
            bin.range = [r0, r1];
            bin.outliers = bin.filter(v => v.y < r0 || v.y > r1); // TODO
            return bin;
          });

          var x = d3.scaleLinear()
          .domain([d3.min(bins, d => d.x0), d3.max(bins, d => d.x1)])
          .rangeRound([margin.left, width - margin.right]);

          var y = d3.scaleLinear()
           .domain([d3.min(bins, d => d.range[0]), d3.max(bins, d => d.range[1])]).nice()
          .range([height - margin.bottom, margin.top]);

          var g = svg.append("g")
            .selectAll("g")
            .data(bins)
            .join("g");

          g.append("path")
              .attr("stroke", "currentColor")
              .attr("d", d => `
                M${x((d.x0 + d.x1) / 2)},${y(d.range[1])}
                V${y(d.range[0])}
              `);

          g.append("path")
              .attr("fill", d3[definedColor](1))
              .attr("d", d => `
                M${x(d.x0) + 1},${y(d.quartiles[2])}
                H${x(d.x1)}
                V${y(d.quartiles[0])}
                H${x(d.x0) + 1}
                Z
              `);

          g.append("path")
              .attr("stroke", "currentColor")
              .attr("stroke-width", 2)
              .attr("d", d => `
                M${x(d.x0) + 1},${y(d.quartiles[1])}
                H${x(d.x1)}
              `);

          g.append("g")
              .attr("fill", "currentColor")
              .attr("fill-opacity", 0.2)
              .attr("stroke", "none")
              .attr("transform", d => `translate(${x((d.x0 + d.x1) / 2)},0)`)
            .selectAll("circle")
            .data(d => d.outliers)
            .join("circle")
              .attr("r", 2)
              .attr("cx", () => (Math.random() - 0.5) * 4)
              .attr("cy", d => y(d[1]));

          svg.append("g")
              .call(xAxis);

          svg.append("g")
              .call(yAxis);

        break;
      case "sunburst":
        var radius = width / 2;
        $(elementId).css('height', 'auto');
        var svg = d3.select($(elementId)[0]).append("svg")
          .attr("width", width)
          .attr("height", width)
          .style("width", "100%")
          .style("height", "auto")
          .style("padding", "10px")
          .style("font", "10px sans-serif")
          .style("box-sizing", "border-box");

        var arc = d3.arc()
          .startAngle(d => d.x0)
          .endAngle(d => d.x1)
          .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
          .padRadius(radius / 2)
          .innerRadius(d => d.y0)
          .outerRadius(d => d.y1 - 1);

        var format = d3.format(",d");
        var color = d3.scaleOrdinal(d3.quantize(d3[definedColor], data.children.length + 1));

        var partition = data => d3.partition()
          .size([2 * Math.PI, radius])
        (d3.hierarchy(data)
          .sum(d => d[params.count_field])
          .sort((a, b) => b[params.count_field] - a[params.count_field]));

        var root = partition(data);

        svg.append("g")
            .attr("fill-opacity", 0.6)
          .selectAll("path")
          .data(root.descendants().filter(d => d.depth))
          .enter().append("path")
            .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
            .attr("d", arc)
          .append("title")
            .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

        svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
          .selectAll("text")
          .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
          .enter().append("text")
            .attr("transform", function(d) {
              var x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
              var y = (d.y0 + d.y1) / 2;
              return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .text(d => d.data.name);

        autosize(svg.node(), elementId);
        break;
      case "cluster":
        $(elementId).css('height', 'auto');
        var svg = d3.select($(elementId)[0]).append("svg");

        var tree = data => {
          var root = d3.hierarchy(data)
              .sort((a, b) => (a.height - b.height) || a.data.name.localeCompare(b.data.name));
          root.dx = 10;
          root.dy = width / (root.height + 1);
          return d3.cluster().nodeSize([root.dx, root.dy])(root);
        };

        var root = tree(data);
       
        let x0 = Infinity;
        let x1 = -x0;
        root.each(d => {
          if (d.x > x1) x1 = d.x;
          if (d.x < x0) x0 = d.x;
        });

        svg.attr("width", width)
            .attr("height", x1 - x0 + root.dx * 2);

        var g = svg.append("g")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .attr("transform", `translate(${root.dy / 3},${root.dx - x0})`);

        var link = g.append("g")
          .attr("fill", "none")
          .attr("stroke", d3[definedColor](1))
          .attr("stroke-opacity", 0.4)
          .attr("stroke-width", 1.5)
        .selectAll("path")
          .data(root.links())
          .join("path")
            .attr("d", d => `
              M${d.target.y},${d.target.x}
              C${d.source.y + root.dy / 2},${d.target.x}
               ${d.source.y + root.dy / 2},${d.source.x}
               ${d.source.y},${d.source.x}
            `);

        var node = g.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 3)
          .selectAll("g")
          .data(root.descendants().reverse())
          .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        node.append("circle")
            .attr("fill", d => d.children ? d3[definedColor](1) : "#999")
            .attr("r", 2.5);

        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -6 : 6)
            .text(d => d.data.name)
          .filter(d => d.children)
            .attr("text-anchor", "end")
          .clone(true).lower()
            .attr("stroke", "white");

        break;
      case "pie":
        height = width;

        var svg = d3.select($(elementId)[0]).append("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("text-anchor", "middle")
          .style("font", "12px sans-serif");

        var color = d3.scaleOrdinal()
          .domain(data.map(d => d.label))
          .range(d3.quantize(d3[definedColor], data.length + 1).reverse())
        var arc = d3.arc()
          .innerRadius(0)
          .outerRadius(Math.min(width, height) / 2 - 1);
        
        var radius = Math.min(width, height) / 2 * 0.8;
        var arcLabel = d3.arc().innerRadius(radius).outerRadius(radius);

        var pie = d3.pie()
          .sort(null)
          .value(d => d.data);
        var arcs = pie(data);

        var g = svg.append("g")
          .attr("transform", `translate(${width / 2},${height / 2})`);
        g.selectAll("path")
          .data(arcs)
          .enter().append("path")
            .attr("fill", d => color(d.data.label))
            .attr("stroke", "white")
            .attr("d", arc)
          .append("title")
            .text(d => `${d.data.label}: ${d.data.data.toLocaleString()}`)

        var text = g.selectAll("text")
          .data(arcs)
          .enter().append("text")
            .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
            .attr("dy", "0.35em");
  
        text.append("tspan")
            .attr("x", 0)
            .attr("y", "-0.7em")
            .style("font-weight", "bold")
            .text(d => d.data.label);
  
        text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
            .attr("x", 0)
            .attr("y", "0.7em")
            .attr("fill-opacity", 0.7)
            .text(d => d.data.data.toLocaleString());

        break;
      case "bars":
        var svg = d3.select($(elementId)[0]).append("svg")
          .attr("width", width)
          .attr("height", height);

        var margin = ({top: 20, right: 0, bottom: 30, left: 40});
        var yAxis = g => g
          .attr("transform", `translate(${margin.left},0)`)
          .call(d3.axisLeft(y))
          .call(g => g.select(".domain").remove());

        var xAxis = g => g
          .attr("transform", `translate(0,${height - margin.bottom})`)
          .call(d3.axisBottom(x).tickSizeOuter(0));

        var y = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.data.length)]).nice()
          .range([height - margin.bottom, margin.top])

        var x = d3.scaleBand()
          .domain(data.map(d => d.label))
          .range([margin.left, width - margin.right])
          .padding(0.1);

       svg.append("g")
          .attr("fill", d3[definedColor](1))
          .selectAll("rect")
          .data(data)
          .join("rect")
          .attr("x", d => x(d.label))
          .attr("y", d => y(d.data.length))
          .attr("height", d => y(0) - y(d.data.length))
          .attr("width", x.bandwidth());

        svg.append("g")
            .call(xAxis);

        svg.append("g")
            .call(yAxis);
        break;
      case "corelation":
        var keys = [];
        for(var col in fields) {
           // propertyName is what you want
           // you can get the value like this: myObject[propertyName]
           if(col != "_id" && (fields[col] == "int" || fields[col] == "numeric"))
           {
              keys.push(col);
           }
        }
        var keyz = keys[0];
        height = keys.length * 120

        var margin = {top: 20, right: 10, bottom: 20, left: 10};
        var x = new Map(
          Array.from(
            keys,
            key => [key, d3.scaleLinear(d3.extent(data, d => d[key]), [margin.left, width - margin.right])]
          )
        );
        var z = d3.scaleSequential(x.get(keyz).domain().reverse(), d3[definedColor]);
        var y = d3.scalePoint(keys, [margin.top, height - margin.bottom]);

        var svg = d3.select($(elementId)[0]).append("svg")
          .attr("width", width)
          .attr("height", height);

        svg.append("g")
          .attr("fill", "none")
          .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(data.slice().sort((a, b) => d3.ascending(a[keyz], b[keyz])))
        .join("path")
          .attr("stroke", d => z(d[keyz]))
          .attr("stroke-opacity", 0.4)
          .attr("d", d => d3.line()
              .defined(([, value]) => value != null)
              .x(([key, value]) => x.get(key)(value))
              .y(([key]) => y(key))
            (d3.cross(keys, [d], (key, d) => [key, d[key]])))
        .append("title")
          .text(d => d.name);

      svg.append("g")
        .selectAll("g")
        .data(keys)
        .join("g")
          .attr("transform", d => `translate(0,${y(d)})`)
          .each(function(d) { d3.select(this).call(d3.axisBottom(x.get(d))); })
          .call(g => g.append("text")
            .attr("x", margin.left)
            .attr("y", -6)
            .attr("text-anchor", "start")
            .attr("fill", "currentColor")
            .text(d => d))
          .call(g => g.selectAll("text")
            .clone(true).lower()
            .attr("fill", "none")
            .attr("stroke-width", 5)
            .attr("stroke-linejoin", "round")
            .attr("stroke", "white"));

        break;
    }
  }

  function initPlot(elementId, sortData, resource, params) {
    var queryParams = generateQueryParams(resource, params);

    $.when(
      recline.Backend.Ckan.fetch(resource),
      recline.Backend.Ckan.query(queryParams, resource)
    ).done(function(fetch, query) {
      var fields = groupByFieldType(fetch.fields),
          config = params.y_axis ? plotConfig(fields, params) : {},
          hits = query.hits,
          data;

      if (sortData) {
        hits = sortData(hits);
      }

      data = params.y_axis ? prepareDataForPlot(fields, hits, config.xaxis, config.yaxis, params) : hits;

      ckan.views.basiccharts.actualType = params.chart_type;
      ckan.views.basiccharts.actualElementId = elementId;
      ckan.views.basiccharts.actualParams = params;
      ckan.views.basiccharts.actualFields = fields;

      if(params.chart_type == "hexbin"){
        data = data[0].data;
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "corelation"){
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "boxplot"){
        data = data[0].data;
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "pie"){
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "bars"){
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "sunburst") {
        data = hierarchyData(data, params);
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else if(params.chart_type == "cluster") {    
        data = hierarchyData(data, params);
        ckan.views.basiccharts.actualData = data;

        self.redrawGraph();
      } else {
        ckan.views.basiccharts.actualData = data;

        $.plot(elementId, data, config);
      }
    });
  }

  function generateQueryParams(resource, params) {
    var query = {
      filters: [],
      sort: [],
      size: 1000
    };

    if (params.filters) {
      query.filters = $.map(params.filters, function (values, field) {
        return {
          type: "term",
          field: field,
          term: values
        };
      });
    }

    if (params.horizontal && params.x_axis) {
      query.sort = [{ field: params.x_axis, order: "ASC" }];
    } else if(params.y_axis) {
      query.sort = [{ field: params.y_axis, order: "DESC" }];
    }

    return query;
  }

  function autosize(svg, elementId) {
    $(elementId)[0].appendChild(svg);
    var box = svg.getBBox();
    //$(elementId)[0].removeChild(svg);
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    return svg;
  }

  function hierarchyData(array, prms){
    var map = {}
    for(var i = 0; i < array.length; i++){
        var obj = array[i];
        if(!obj[prms.name_field]){
          continue;
        }

        if(!(obj[prms.id_field] in map)){
            map[obj[prms.id_field]] = obj
            map[obj[prms.id_field]].children = []
        }

        if(typeof map[obj[prms.id_field]].name == 'undefined'){
            map[obj[prms.id_field]][prms.id_field] = obj[prms.id_field]
            map[obj[prms.id_field]][prms.count_field] = obj[prms.count_field]
            map[obj[prms.id_field]][prms.parent_id_field] = obj[prms.parent_id_field]
            map[obj[prms.id_field]].name = obj[prms.name_field]
        }

        var parent = obj[prms.parent_id_field] || '-';
        if(!(parent in map)){
            map[parent] = {}
            map[parent].children = []
        }

        map[parent].children.push(map[obj[prms.id_field]])
    }
    return map['-'].children[0];
  }

  function groupByFieldType(fields) {
    var result = {};
    $.each(fields, function (i, field) {
      result[field.id] = field.type;
    });
    return result;
  }

  function prepareDataForPlot(fields, records, xAxis, yAxis, params) {
    var grouppedData = convertAndGroup(fields, records, params),
        xAxisMode = xAxis && xAxis.mode,
        yAxisMode = yAxis.mode,
        areWePlottingTime = (yAxisMode === "time" || xAxisMode === "time"),
        barWidth = areWePlottingTime ? 60*60*24*30*1000 : 0.5,
        chartTypes = {
          lines: { show: true },
          bars: {
            show: true,
            horizontal: params.horizontal,
            align: "center",
            barWidth: barWidth
          }
        };

    return $.map(grouppedData, function(data, label) {
      var dataForPlot = {
        label: label,
        data: data
      };
      dataForPlot[params.chart_type] = chartTypes[params.chart_type];

      return dataForPlot;
    });
  }

  function plotConfig(fields, params) {
    var config,
        xAxisType = fields[params.x_axis],
        yAxisType = fields[params.y_axis],
        axisConfigByType = {
          timestamp: { mode: "time" },
          text: {
            mode: "categories",
            tickColor: "rgba(0, 0, 0, 0)",
            tickFormatter: function (value, axis) {
              return value;
            }
          },
          numeric: {},
          integer: {}
        };

    config = {
      yaxis: axisConfigByType[yAxisType],
      colors: ['#e41a1c', '#377eb8', '#4daf4a',
               '#984ea3', '#ff7f00', '#ffff33',
               '#a65628', '#f781bf', '#999999']
    };

    if (params.chart_type == "pie") {
      config = $.extend(config, {
        series: {
          pie: {
            show: true
          }
        },
        legend: {
          show: false
        }
      });
    } else {
      config = $.extend(config, {
        grid: {
          hoverable: true,
          borderWidth: 0
        },
        legend: {
          show: params.show_legends
        },
        tooltip: true,
        tooltipOpts: {
          content: "%s | "+params.x_axis+": %x | "+params.y_axis+": %y",
          xDateFormat: "%d/%m/%Y",
          yDateFormat: "%d/%m/%Y"
        }
      });
    }

    if (xAxisType) {
      config.xaxis = axisConfigByType[xAxisType];
    }

    return config;
  }

  function convertAndGroup(fields, records, params) {
    var result = {},
        xAxisParser = parsers[fields[params.x_axis]],
        yAxisParser = parsers[fields[params.y_axis]];
    $.each(records, function(i, record) {
      var y = record[params.y_axis],
          yParsed = yAxisParser(y),
          group_by = record[params.group_by] || '';

      if (y === null) {
        return;
      }

      if (params.x_axis) {
        var x = record[params.x_axis],
            xParsed = xAxisParser(x);

        if (x === null) {
          return;
        }
        result[group_by] = result[group_by] || [];
        result[group_by].push([xParsed, yParsed]);
      } else {
        result[group_by] = result[group_by] || 0;
        result[group_by] = result[group_by] + yParsed;
      }
    });
    return result;
  }
})(this.ckan.views.basiccharts, this.jQuery);
