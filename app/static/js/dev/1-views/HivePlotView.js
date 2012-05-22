var HivePlotView = Backbone.View.extend({
    events: {},
    initialize: function(options) {
    	if(!this.model) {
    		this.model = new HivePlotModel();
    	}
    	
    	this.model.bind("change:numericalValue", this.numericalValueChanged, this);
    	this.model.bind("change:axisScale", this.axisScaleChanged, this);
    	this.model.bind("change:mapAxis1", this.mapAxisChanged, this);
    	this.model.bind("change:mapAxis2", this.mapAxisChanged, this);
    	this.model.bind("change:mapAxis3", this.mapAxisChanged, this);
    	this.model.bind("change:directionAxis1", this.directionAxisChanged, this);
    	this.model.bind("change:directionAxis2", this.directionAxisChanged, this);
    	this.model.bind("change:directionAxis3", this.directionAxisChanged, this);
    	
    	this.nodes = options.nodes;
    	this.flows = options.flows;
    	this.timeline = options.timeline;
    	this.nodes.bind("reset", this.updateNodes, this);
    	this.flows.bind("reset", this.updateFlows, this);
    	
    	this.data_links = [];
    	this.node_map = {};
    	
    	this.num_axes = 3;
    },
    render: function() {
    	var container = $(this.el).empty();
    	
    	this.r1 = container.width() > container.height() ? container.height() / 2 : container.width() / 2,
    	this.r0 = 0.2 * this.r1;
    		
    	var svg = d3.select(container.get(0))
    	.append("svg")
			.attr("width", 2*this.r1)
			.attr("height", 2*this.r1);

        this.svg_defs = svg.append("svg:defs");
        
		svg = svg.append("svg:g")
			.attr("transform", "translate(" + this.r1 + "," + this.r1 + ")");	
		
		this.svg_axis = svg.append("svg:g");
		this.svg_links = svg.append("svg:g");
		
		this.renderAxis();
		this.renderLinks();
			
		return this;
    },
    renderAxis: function() {
    	if(!this.svg_axis) {
    		this.render();
    	}
    	
    	var that = this;
        var direction_settings = [
    	   this.model.get("directionAxis1"),
    	   this.model.get("directionAxis2"),
    	   this.model.get("directionAxis3")];
    	   
    	this.svg_axis.selectAll(".axis").remove();
    	var axis_group = this.svg_axis.selectAll(".axis")
			.data(direction_settings)
		.enter().append("svg:g")
			.attr("class", "axis");
		
		axis_group.append("svg:line")
			.attr("x1", function(d, i) { return that.hiveXY(i, 0)[0]; })
			.attr("x2", function(d, i) { return that.hiveXY(i, 1)[0]; })
			.attr("y1", function(d, i) { return that.hiveXY(i, 0)[1]; })
			.attr("y2", function(d, i) { return that.hiveXY(i, 1)[1]; });
		axis_group.append("svg:text")
			.attr("dx", function(d, i) { return that.hiveXY(i, -0.1)[0]; })
			.attr("dy", function(d, i) { return that.hiveXY(i, -0.1)[1]; })
			.text(function(d, i) { return i+1; });
			
        this.svg_defs.select("#markerArrow").remove();
        this.svg_defs.append("svg:marker")
            .attr("id", "markerArrow")
            .attr("viewBox", "0 0 10 10")
            .attr("refX", 0)
            .attr("refY", 5)
            .attr("markerUnits", "strokeWidth")
            .attr("markerWidth", 6)
            .attr("markerHeight", 4)
            .attr("orient", "auto")
            .append("svg:path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .attr("fill", "#888");

        var line = d3.svg.line()
    			.interpolate("cardinal");
        axis_group.select(function(d) { return d === "both" ? null : this; })
        .append("svg:path")
            .attr("class", "direction")
            .attr("d", function(d, i) { 
                if(d === "clockwise") {
                    return line([
                        that.hiveXY((i+0.45)%that.num_axes, 0.9),
                        that.hiveXY((i+0.47)%that.num_axes, 0.915),
                        that.hiveXY((i+0.5)%that.num_axes, 0.92),
                        that.hiveXY((i+0.53)%that.num_axes, 0.915), 
                        that.hiveXY((i+0.55)%that.num_axes, 0.9)]); 
                }
                else if(d === "counter-clockwise") {
                    return line([
                        that.hiveXY((i+0.55)%that.num_axes, 0.9),
                        that.hiveXY((i+0.53)%that.num_axes, 0.915),
                        that.hiveXY((i+0.5)%that.num_axes, 0.92),
                        that.hiveXY((i+0.47)%that.num_axes, 0.915), 
                        that.hiveXY((i+0.45)%that.num_axes, 0.9)]); 
                }
            })
            .attr("stroke", "#ffffff")
            .attr("fill", "none")
            .attr("marker-end", "url(#markerArrow)");
    
    	return this;
    },
    renderLinks: function() {
    	if(!this.svg_links) {
    		this.render();
    	}
    	
    	var that = this,
    		color = this.timeline.get("color");
    		line = d3.svg.line()
    			.interpolate("bundle")
    			.tension(0.8);
    	
    	this.data_links.forEach(function(link) {
    		link["line"] = that.hiveLine(link);
    	});
    	
    	this.svg_links.selectAll(".link").remove();
    	this.svg_links.selectAll(".link")
    		.data(this.data_links)
    	.enter().append("svg:path")
    		.attr("class", "link")
    		.attr("d", function(d) { return line(d.line); })
    		.attr("stroke", function(d) { return color(d.t); });
    	
    	return this;
    },	
    // Get the XY position of a point on an axis [0,num_axes-1] with pos [0,1]
	// It is possible to apply an additional positive or negative padding perpendicular to the axis.
	hiveXY:	function(axis, pos, padding) {
		padding = padding || 0;
		var angle = axis / this.num_axes * 2 * Math.PI;
		// 0.95 is a factor to make the whole graph smaller
		var radius = pos * (this.r1*0.95) + (1-pos) * this.r0;
		var v_axis = [Math.sin(angle), -Math.cos(angle)];
		var v_padding = [-1*v_axis[1], v_axis[0]];
		return [
			v_axis[0]*radius + v_padding[0]*padding,
			v_axis[1]*radius + v_padding[1]*padding
		];
	},
	// Generate points for line generator
	hiveLine: function(link) {
		var r0, r1, a0, a1;
		if(link.target.axis === 0 && link.source.axis === this.num_axes-1) {
			r0 = link.source.pos;
			r1 = link.target.pos;
			a0 = link.source.axis;
			a1 = link.target.axis;
		}
		else if(link.source.axis === 0 && link.target.axis === this.num_axes-1) {
			r0 = link.target.pos;
			r1 = link.source.pos;
			a0 = link.target.axis;
			a1 = link.source.axis;
		}
		else if(link.source.axis < link.target.axis) {
			r0 = link.source.pos;
			r1 = link.target.pos;
			a0 = link.source.axis;
			a1 = link.target.axis;
		}
		else {
			r0 = link.target.pos;
			r1 = link.source.pos;
			a0 = link.target.axis;
			a1 = link.source.axis;
		}
		
		var p0 = this.hiveXY(a0, r0, 5),
		    p1 = this.hiveXY(a0, r0, 0.3 * (this.r0 * (1-r0) + this.r1 * r0)),
		    p2 = this.hiveXY(a0 + 0.5, r0 > r1 ? r0 : r1),
		    p3 = this.hiveXY(a1, r1, -0.3 * (this.r0 * (1-r1) + this.r1 * r1)),
		    p4 = this.hiveXY(a1, r1, -5);
		
		return [p0, p1, p2, p3, p4];
	},
    updateNodes: function() {
		var that = this;
    	var pos_scale,
    		numerical_value = this.model.get("numericalValue"),
    		max_value = d3.max(this.nodes.models, function(d) { return d.get(numerical_value); });
    	
    	if(this.model.get("axisScale") === "log") {
    		pos_scale = d3.scale.log();
    	}
    	else {
			pos_scale = d3.scale.linear();    	
    	}
    	pos_scale.range([0, 1]).domain([1, max_value]);
		
		// parse axis mapping
		var map_axis = [
			this.model.get("mapAxis1"),
			this.model.get("mapAxis2"),
			this.model.get("mapAxis3")],
			axis_prefixes = [];
			
		for(var a = 0; a < this.num_axes; a++) {
			var lines = map_axis[a].split("\n");
			for(var i = 0; i < lines.length; i++) {
				var cidr = $.trim(lines[i]).split("/");
				if(cidr.length === 1 || cidr.length === 2) {
					var mask = 32;
					if(cidr.length === 2) {
						mask = parseInt(cidr[1]);
						if(mask < 0) {
				            mask = 0;
						}
					}
					
					// check for NaN
					if(mask === mask) {
						var ip = FlowInspector.strToIp(cidr[0]);
						if(ip !== false) {
							if(!axis_prefixes[mask]) {
								axis_prefixes[mask] = [];
							}
							if(!axis_prefixes[mask][a]) {
								axis_prefixes[mask][a] = [];
							}
							
							// in JavaScript shifting by >= 32 bit doesn't work
    						// have to cover this case separately
    						if(mask === 0) {
    							axis_prefixes[mask][a].push(0);
    						}
    						else {
								axis_prefixes[mask][a].push(ip >>> (32-mask));
							}
						}
					}
				}
			}
		}
		
    	var node_to_axis = function(node, i) {
            var ret = [];
    		for(var mask = 32; mask >= 0; mask--) {
                if(!axis_prefixes[mask]) {
                    continue;
                }
    			for(var axis in axis_prefixes[mask]) {
    				var prefixes = axis_prefixes[mask][axis];
    				for(var i = 0; i < prefixes.length; i++) {
    					// in JavaScript shifting by >= 32 bit doesn't work
    					// have to cover this case separately
    					if(mask === 0) {
    						ret.push(Number(axis));
    					}
    					else if(node.id >>> (32-mask) === prefixes[i]) {
    						ret.push(Number(axis));
    					}
    				}
    			}
    			if(ret.length > 0) {
                    return ret;
    			}
    		}
    		return [];
    	};
    	var node_to_pos = function(node, i) {
    		return pos_scale(node.get(numerical_value));
    	};
    	
    	this.node_map = {};
    	
    	this.nodes.each(function(node, i) {
    		var axis = node_to_axis(node, i);
    		for(var i = 0; i < axis.length; i++) {
                if(that.node_map[node.id] === undefined) {
                    that.node_map[node.id] = [];
                }
                that.node_map[node.id].push({
        			model: node,
        			axis: axis[i],
        			pos: node_to_pos(node, i)
        		});
    		}
    	});
		
		this.renderAxis();
    },
    updateFlows: function() {
    	var that = this;
    	this.data_links = [];
    	var direction_settings = [
    	   this.model.get("directionAxis1"),
    	   this.model.get("directionAxis2"),
    	   this.model.get("directionAxis3")];
    	
    	var min_bucket = d3.min(this.flows.models, function(d) { return d.get("bucket"); });
    	var max_bucket = d3.max(this.flows.models, function(d) { return d.get("bucket"); });
    	
		this.flows.each(function(m) {
			var source = that.node_map[m.get("srcIP")];
			var target = that.node_map[m.get("dstIP")];
			
			if(!source || source.length === 0 || !target || target.length === 0) {
				return;
			}
			
			var ct = 1.0;
			if(min_bucket < max_bucket) {
				ct = (m.get("bucket").getTime() - min_bucket.getTime()) / (max_bucket.getTime() - min_bucket.getTime());
			}
			
			// source and target are arrays,
			// because the same CIDR could exist on several axis
			for(var i = 0; i < source.length; i++) {
                for(var j = 0; j < target.length; j++) {
                    var s = source[i],
                        t = target[j];
                
        			// filter flows with target axis = source axis
        			if(t.axis === s.axis) {
        				continue;
        			}
        			
        			// filter according to flow direction
                    var daxis = (s.axis < t.axis) ? s.axis : t.axis;
                    if((s.axis == 0 && t.axis == that.num_axes-1) || (s.axis == that.num_axes-1 && t.axis == 0)) {
                        daxis = that.num_axes-1;
                    }
                    var dsetting = direction_settings[daxis];
                    if(dsetting === "both" ||
                        (dsetting === "clockwise" && s.axis === daxis) ||
                        (dsetting === "counter-clockwise" && t.axis === daxis)) {
                    
            			that.data_links.push({
            				source: s,
            				target: t,
            				model: m,
            				t: ct
            			});
        			}
                }
			}
		});
		
		this.renderLinks();
    },
    numericalValueChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    },
    axisScaleChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    },
    mapAxisChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    },
    directionAxisChanged: function(model, value) {
        this.renderAxis();
    	this.updateFlows();
    }
});