var BucketChartView = Backbone.View.extend({
	className: "bucket-chart",
    events: {},
    initialize: function() {
    	if(!this.model) {
    		this.model = new BucketChartModel();
    	}
    	
    	this.model.bind("change:value", this.changeValue, this);
    	
    	this.loaderTemplate = _.template($("#loader-template").html());
    	
    	// chart formatting
    	this.m = [10, 20, 30, 70];
    	this.stroke = d3.interpolateRgb("#0064cd", "#c43c35");
    	
    	this.flows = new Flows();
    	this.flows.bind("reset", this.render, this);
    	// fetch at the end because a cached request calls render immediately!
    	this.flows.fetch({ data: { "resolution": 1000 } });
    },
    render: function() {
    	var container = $(this.el).empty(),
    		num_val = this.model.get("value"),
    		w = container.width() - this.m[1] - this.m[3],
    		h = 200 - this.m[0] - this.m[2],
    		x = d3.time.scale().range([0, w]),
    		y = d3.scale.linear().range([h, 0]),
    		stroke = this.stroke,
    		data = this.flows.models,
    		bucket_size = this.flows.bucket_size,
    		xAxis = this.getXAxis(h, x),
    		yAxis = this.getYAxis(y),
    		titleFormat = this.getTitleFormat();
    		
    	// check if container was removed from DOM	
    	if(w <= 0) {
    		return;
    	}
    		
		// A SVG element.
    	this.svg = d3.select(container.get(0))
    	    .data([data])
    	.append("svg:svg")
    	    .attr("width", w + this.m[1] + this.m[3])
    	    .attr("height", h + this.m[0] + this.m[2])
    	.append("svg:g")
    	    .attr("transform", "translate(" + this.m[3] + "," + this.m[0] + ")");
    	
    	if(data.length === 0) {
    		container.append(this.loaderTemplate());
    		return this;
    	}
    	    
    	this.axisGroup = this.svg.append("svg:g");
    	this.barsGroup = this.svg.append("svg:g");
    	this.labelGroup = this.svg.append("svg:g");

    	// Set the scale domain
    	var min_bucket = d3.min(data, function(d) { return d.get("bucket"); });
    	var max_bucket = d3.max(data, function(d) { return d.get("bucket"); });
    	var max_value = d3.max(data, function(d) { return d.get(num_val); });
    	x.domain([min_bucket, new Date(max_bucket.getTime() + bucket_size*1000)]);
		y.domain([0, max_value]);
    	   
    	this.axisGroup.append("g")
  			.attr("class", "x axis")
  			.attr("transform", "translate(0," + h + ")")
  			.call(xAxis);
    	this.axisGroup.append("g")
  			.attr("class", "y axis")
  			.call(yAxis);
    	
    	var bar = this.barsGroup.selectAll("g.bar")
    		.data(data);
    		
    	var bar_enter =	bar.enter().append("g")
    		.attr("class", "bar")
    		.attr("transform", function(d) { return "translate(" + x(d.get("bucket")) + ",0)"; })
    		.attr("title", titleFormat)
    		.on("mouseover", function(d) {
    			d3.select(this).selectAll("rect")
    				.attr("fill", stroke(d.get(num_val) / max_value));
    		})
    		.on("mouseout", function(d) {
    			d3.select(this).selectAll("rect")
    				.attr("fill", "rgba(0,100,205,0.2)");
    		});

    	bar_enter.append("rect")
    		.attr("width", x(new Date(min_bucket.getTime() + bucket_size*1000)))
    		.attr("height", function(d) { return h - y(d.get(num_val)); })
    		.attr("y", function(d) { return y(d.get(num_val)); })
    		.attr("fill", "rgba(0,100,205,0.2)");
    	bar_enter.append("line")
    		.attr("x1", 0)
    		.attr("x2", x(new Date(min_bucket.getTime() + bucket_size*1000)))
    		.attr("y1", function(d) { return y(d.get(num_val)); })
    		.attr("y2", function(d) { return y(d.get(num_val)); })
    		.attr("stroke", function(d) { return stroke(d.get(num_val) / max_value); });
    	
    	this.labelGroup.append("text")
    		.attr("x", w-5)
    		.attr("y", h-5)
    		.attr("text-anchor", "end")
    		.text("#" + num_val);
    		
    	$(".bar", this.el).twipsy({ offset: 3 });
    	
    	return this;
    },
    changeValue: function(model, value) {
		
		if(!this.barsGroup) {
			return;
		}
	
		var container = $(this.el),
    		w = container.width() - this.m[1] - this.m[3],
    		h = 200 - this.m[0] - this.m[2],
    		x = d3.time.scale().range([0, w]),
    		y = d3.scale.linear().range([h, 0]),
    		stroke = this.stroke,
    		data = this.flows.models,
    		bucket_size = this.flows.bucket_size,
    		xAxis = this.getXAxis(h, x),
    		yAxis = this.getYAxis(y),
    		titleFormat = this.getTitleFormat();
		
		// Set the scale domain
    	var min_bucket = d3.min(data, function(d) { return d.get("bucket"); });
    	var max_bucket = d3.max(data, function(d) { return d.get("bucket"); });
    	var max_value = d3.max(data, function(d) { return d.get(value); });
    	x.domain([min_bucket, new Date(max_bucket.getTime() + bucket_size*1000)]);
		y.domain([0, max_value]);
		
		this.axisGroup.selectAll("g").remove();
    	this.axisGroup.append("g")
  			.attr("class", "x axis")
  			.attr("transform", "translate(0," + h + ")")
  			.call(xAxis);
    	this.axisGroup.append("g")
  			.attr("class", "y axis")
  			.call(yAxis);
    	
    	var bar = this.barsGroup.selectAll("g.bar")
    		.data(data)
    		.attr("title", titleFormat);
    		
    	bar.selectAll("rect")
    		.transition()
    		.duration(1000)
    		.attr("width", x(new Date(min_bucket.getTime() + bucket_size*1000)))
    		.attr("height", function(d) { return h - y(d.get(value)); })
    		.attr("y", function(d) { return y(d.get(value)); });
    		
    	bar.selectAll("line")
    		.transition()
    		.duration(1000)
    		.attr("x1", 0)
    		.attr("x2", x(new Date(min_bucket.getTime() + bucket_size*1000)))
    		.attr("y1", function(d) { return y(d.get(value)); })
    		.attr("y2", function(d) { return y(d.get(value)); })
    		.attr("stroke", function(d) { return stroke(d.get(value) / max_value); });
    	
    	this.labelGroup.select("text")
    		.text("#" + value);
    		
    	$(".bar", this.el).twipsy({ offset: 3 });
    },
    getXAxis: function(h, scaleX) {
    	return d3.svg.axis().scale(scaleX)
    		.tickSize(-h,2,0)
    		.ticks(4)
    		.tickSubdivide(10)
    		.tickPadding(10)
    		.tickFormat(d3.time.format("%Y-%m-%d %H:%M:%S"));
    },
    getYAxis: function(scaleY) {
		var axis = d3.svg.axis().scale(scaleY)
			.orient("left")
			.tickSize(2);
    		
    	var value = this.model.get("value");
    	if(value === "pkts") {
			axis.tickFormat(function(d) { return Math.floor(d/1000)+"k"; });
		}
		else if(value === "bytes") {
			axis.tickFormat(function(d) { return (d3.format(".2f"))(d/1024/1024)+" MB"; });
		}
		
		return axis;
    },
    getTitleFormat: function() {
    	var value = this.model.get("value");
    	if(value === "pkts") {
			return function(d) { return Math.floor(d.get(value)/1000)+"k pakets"; };
		}
		if(value === "bytes") {
			return function(d) { return (d3.format(".2f"))(d.get(value)/1024/1024)+" MB"; };
		}
		return function(d) { return Math.floor(d.get(value)) + " flows" };
    }
});