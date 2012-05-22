var TimelineView = Backbone.View.extend({
	className: "timeline-view",
    events: {
    	"mousedown svg": "startDrag",
    	"mousemove svg": "moveDrag"
    },
    initialize: function() {
    	if(!this.model) {
    		this.model = new TimelineModel();
    	}
    	
    	this.model.bind("change:value", this.changeValue, this);
    	this.model.bind("change:interval", this.changeBucketInterval, this);
    	
    	this.loaderTemplate = _.template($("#loader-template").html());
    	
    	var that = this;
    	// make function available to unbind later
    	this._onResize = function() { that.render(); };
    	$(window).bind("resize", this._onResize);
    	
    	this._documentMouseUp = function() { that.endDrag(); };
    	$(document).bind("mouseup", this._documentMouseUp);
    	
    	// chart formatting
    	this.m = [0, 0, 20, 0];
    	this.stroke = d3.interpolateRgb("#0064cd", "#c43c35");
    	
    	this.flows = new Flows();
    	this.flows.bind("reset", this.resetFlows, this);
    	// fetch at the end because a cached request calls render immediately!
    	this.flows.fetch({ data: { "resolution": 1000 } });
    },
    remove: function() {
    	$(window).unbind("resize", this._onResize);
    	$(document).unbind("mouseup", this._documentMouseUp);
    	$(this.el).remove();
    	return this;
    },
    resetFlows: function() {
    	var data = this.flows.models;
    	this.min_bucket = d3.min(data, function(d) { return d.get("bucket"); });
    	this.max_bucket = d3.max(data, function(d) { return d.get("bucket"); });
    			
    	var color = [
    		d3.interpolateRound(100, 255),
    		d3.interpolateRound(255, 50),
    		d3.interpolateRound(100, 50),
    		d3.interpolateNumber(0.1, 0.3)];
    		
    	this.model.set({
    		bucket_size: this.flows.bucket_size,
    		interval: [this.min_bucket, this.min_bucket],
    		color: function(t) { return "rgba(" + color[0](t) + "," + color[1](t) + "," + color[2](t) + "," + color[3](t) + ")"; }
    	});
    
    	this.render();
    	return this;
    },
    render: function() {
    	var container = $(this.el).empty(),
    		num_val = this.model.get("value"),
    		w = container.width() - this.m[1] - this.m[3],
    		h = container.height() - this.m[0] - this.m[2],
    		x = d3.time.scale().range([0, w]),
    		y = d3.scale.linear().range([h, 0]),
    		stroke = this.stroke,
    		data = this.flows.models,
    		bucket_size = this.flows.bucket_size,
    		xAxis = this.getXAxis(h, x),
    		titleFormat = this.getTitleFormat();
    		
    	// check if container was removed from DOM	
    	if(w <= 0 || h <= 0) {
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
    	   
    	this.selectionGroup = this.svg.append("svg:g").attr("class", "selection");
    	this.axisGroup = this.svg.append("svg:g");
    	this.barsGroup = this.svg.append("svg:g");
    	this.labelGroup = this.svg.append("svg:g");

    	// Set the scale domain
    	var max_value = d3.max(data, function(d) { return d.get(num_val); });
    	x.domain([this.min_bucket, new Date(this.max_bucket.getTime() + bucket_size*1000)]);
		y.domain([0, max_value]);
    	   
    	this.axisGroup.append("g")
  			.attr("class", "x axis")
  			.attr("transform", "translate(0," + h + ")")
  			.call(xAxis);
    	
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
    				.attr("fill", function() { return d3.select(this).attr("data-fill"); });
    		});

    	bar_enter.append("rect")
    		.attr("width", x(new Date(this.min_bucket.getTime() + bucket_size*1000)))
    		.attr("height", function(d) { return h - y(d.get(num_val)); })
    		.attr("y", function(d) { return y(d.get(num_val)); })
    		.attr("fill", "rgba(0,100,205,0.3)")
    		.attr("data-fill", "rgba(0,100,205,0.3)");
    	bar_enter.append("line")
    		.attr("x1", 0)
    		.attr("x2", x(new Date(this.min_bucket.getTime() + bucket_size*1000)))
    		.attr("y1", function(d) { return y(d.get(num_val)); })
    		.attr("y2", function(d) { return y(d.get(num_val)); })
    		.attr("stroke", function(d) { return stroke(d.get(num_val) / max_value); });
    	
    	this.labelGroup.append("text")
    		.attr("x", w-5)
    		.attr("y", 10)
    		.attr("text-anchor", "end")
    		.text("#" + num_val);
    		
    	$(".bar", this.el).twipsy({ delayIn: 1000, offset: 3 });
    	
    	this.changeBucketInterval();
    	
    	return this;
    },
    changeValue: function(model, value) {
		
		if(!this.barsGroup) {
			return;
		}
	
		var container = $(this.el),
    		w = container.width() - this.m[1] - this.m[3],
    		h = container.height() - this.m[0] - this.m[2],
    		x = d3.time.scale().range([0, w]),
    		y = d3.scale.linear().range([h, 0]),
    		stroke = this.stroke,
    		data = this.flows.models,
    		bucket_size = this.flows.bucket_size,
    		xAxis = this.getXAxis(h, x),
    		titleFormat = this.getTitleFormat();
		
		// Set the scale domain
    	var max_value = d3.max(data, function(d) { return d.get(value); });
    	x.domain([this.min_bucket, new Date(this.max_bucket.getTime() + bucket_size*1000)]);
		y.domain([0, max_value]);
		
		this.axisGroup.selectAll("g").remove();
    	this.axisGroup.append("g")
  			.attr("class", "x axis")
  			.attr("transform", "translate(0," + h + ")")
  			.call(xAxis);
    	
    	var bar = this.barsGroup.selectAll("g.bar")
    		.data(data)
    		.attr("title", titleFormat);
    		
    	bar.selectAll("rect")
    		.transition()
    		.duration(1000)
    		.attr("width", x(new Date(this.min_bucket.getTime() + bucket_size*1000)))
    		.attr("height", function(d) { return h - y(d.get(value)); })
    		.attr("y", function(d) { return y(d.get(value)); });
    		
    	bar.selectAll("line")
    		.transition()
    		.duration(1000)
    		.attr("x1", 0)
    		.attr("x2", x(new Date(this.min_bucket.getTime() + bucket_size*1000)))
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
    getTitleFormat: function() {
    	var value = this.model.get("value");
    	if(value === "pkts") {
			return function(d) { return Math.floor(d.get(value)/1000)+"k pakets"; };
		}
		if(value === "bytes") {
			return function(d) { return (d3.format(".2f"))(d.get(value)/1024/1024)+" MB"; };
		}
		return function(d) { return Math.floor(d.get(value)) + " flows" };
    },
    startDrag: function(e) {
  		// align start to bucket
  		var container = $(this.el),
    		w = container.width() - this.m[1] - this.m[3],
    		x = d3.time.scale().range([0, w]),
    		data = this.flows.models,
    		bucket_size = this.flows.bucket_size;
    		
    	if(data.length === 0) {
    		return;
    	}
    	
    	x.domain([this.min_bucket.getTime(), this.max_bucket.getTime() + bucket_size * 1000]);
    	
    	var drag_bucket = x.invert(e.offsetX);
    	var bucket = this.min_bucket.getTime();
    	while(bucket + bucket_size*1000 <= drag_bucket) {
    		bucket += bucket_size*1000;
    	}
    	this._drag_start = new Date(bucket);
    },
    moveDrag: function(e) {
    	if(this._drag_start) {
    		// align end to bucket
    		var container = $(this.el),
    		w = container.width() - this.m[1] - this.m[3],
    		x = d3.time.scale().range([0, w]),
    		bucket_size = this.flows.bucket_size;
    	
	    	x.domain([this.min_bucket.getTime(), this.max_bucket.getTime() + bucket_size * 1000]);
	    	
	    	var drag_bucket = x.invert(e.offsetX);
	    	var bucket = this.min_bucket.getTime();
	    	while(bucket + bucket_size*1000 <= drag_bucket) {
	    		bucket += bucket_size*1000;
	    	}
	    	this._drag_end = new Date(bucket);
	    	
    		this.updateSelectionView(this._drag_start, this._drag_end);
    	}
    },
    endDrag: function() {
    	if(this._drag_start) {
    		if(this._drag_end) {
    			this.updateSelection(this._drag_start, this._drag_end);
    		}
    		else {
    			this.updateSelection(this._drag_start, this._drag_start);
    		}
    	}
    	this._drag_start = null;
    	this._drag_end = null;
    },
    updateSelection: function(start_bucket, end_bucket) {
    	if(end_bucket < start_bucket) {
    		var s = end_bucket;
    		end_bucket = start_bucket;
    		start_bucket = s;
    	}
    	
    	this.model.set({
    		interval: [start_bucket, end_bucket]
    	});
    },
    updateSelectionView: function(start_bucket, end_bucket) {
    	if(this.selectionGroup) {
    		var container = $(this.el),
    			h = container.height() - this.m[0] - this.m[2],
	    		w = container.width() - this.m[1] - this.m[3],
	    		x = d3.time.scale().range([0, w]),
	    		bucket_size = this.flows.bucket_size;
	    		
			// Set the scale domain
	    	x.domain([this.min_bucket, new Date(this.max_bucket.getTime() + bucket_size*1000)]);
	    	
	    	if(end_bucket < start_bucket) {
    			var s = end_bucket;
    			end_bucket = start_bucket;
    			start_bucket = s;
    		}
	    	
	    	var start_x = x(start_bucket),
	    		end_x = x(new Date(end_bucket.getTime() + bucket_size*1000 - 1));
    		
    		this.selectionGroup.select("rect").remove();
    		
    		this.selectionGroup.append("svg:rect")
    			.attr("width", Math.abs(end_x - start_x))
    			.attr("height", h)
    			.attr("x", start_x < end_x ? start_x : end_x);
    			
    		var color = this.model.get("color");
    			
    		this.barsGroup.selectAll("rect")
    			.attr("fill", function(d) {
    				var bucket = d.get("bucket");
    				if(bucket < start_bucket || bucket > end_bucket) {
    					return "rgba(0,100,205,0.3)";
    				}
    				var t = 1.0;
    				if(end_bucket > start_bucket) {
    					t = (bucket.getTime() - start_bucket.getTime()) / (end_bucket.getTime() - start_bucket.getTime());
    				}
    				return color(t);
    			})
    			.attr("data-fill", function() { return d3.select(this).attr("fill"); });
    	}
    },
    changeBucketInterval: function() {
    	if(this.selectionGroup) {
    		var interval = this.model.get("interval");
    		if(interval) {
    			this.updateSelectionView(interval[0], interval[1]);
    		}
    	}
    }
});