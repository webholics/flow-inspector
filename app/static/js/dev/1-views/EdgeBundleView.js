var EdgeBundleView = Backbone.View.extend({
    events: {},
    initialize: function(options) {
    	if(!this.model) {
    		this.model = new EdgeBundleModel();
    	}
    	this.model.bind("change:tension", this.tensionChanged, this);
    	this.model.bind("change:groupBytes", this.groupBytesChanged, this);
    	this.model.bind("change:nodeLimit", this.nodeLimitChanged, this);
    	
    	this.nodes = options.nodes;
    	this.flows = options.flows;
    	this.timeline = options.timeline;
    	this.nodes.bind("reset", this.updateNodes, this);
    	this.flows.bind("reset", this.updateFlows, this);
    	
    	this.data_nodes = null;
    	this.data_links = [];
    },
    render: function() {
    	var container = $(this.el).empty();
    	
    	if(!this.data_nodes) {
    		return;
    	}
    	
    	var that = this;
    	var r = container.width() > container.height() ? container.height() / 2 : container.width() / 2,
    		r0 = r - 90;
    	var bundle = d3.layout.bundle();
    	var cluster = d3.layout.cluster()
		    .size([360, r0-10]);
    		
    	this.svg = d3.select(container.get(0))
    	.append("svg")
			.attr("width", 2*r)
			.attr("height", 2*r)
		.append("svg:g")
			.attr("transform", "translate(" + r + "," + r + ")");	
			
		// Defs
		var svg_defs = this.svg.append("defs");
		
		// Nodes	
		var nodes = cluster.nodes(this.data_nodes).filter(function(n) { return !n.children; });	
		var svg_nodes = this.svg.selectAll("g.node")
			.data(nodes)
		.enter().append("svg:g")
			.attr("class", "node")
			.attr("title", function(d) { 
				return "<strong>" + d.name + "</strong><br />" +
					"Flows: " + d.flows + "<br />" +
					"Pakets: " + (d3.format(".2f"))(d.pkts/1000) + "k<br />" +
					"Bytes: " + (d3.format(".2f"))(d.bytes/1024/1024) + " MB";
			})
			.attr("data-placement", function(d) {
				if(d.x < 90 || d.x > 270) {
					return "below";
				}
				return "above";
			})
			.on("mouseover", function(d) {
    			d3.select(this).selectAll("text")
    				.style("fill", function(d) { return d3.rgb(arc_color(d.pkts / arc_max_value)).darker(); });
    			d3.select(this).selectAll(".arc")
    				.attr("fill", function(d) { return d3.rgb(arc_color(d.pkts / arc_max_value)).brighter(3); })
    				.style("opacity", 1);
    				
                var direction = that.model.get("hoverDirection");
    			svg_links.style("display", function(d2) {
                    if((direction === "both" && d2.link.target !== d && d2.link.source !== d) ||
                        (direction === "outgoing" && d2.link.source !== d) ||
                        (direction === "incoming" && d2.link.target !== d)) {
                        
    				    return "none";
    				}
    				return null;
    			});
    		})
    		.on("mouseout", function(d) {
    			d3.select(this).selectAll("text")
    				.style("fill", null);
    			d3.select(this).selectAll(".arc")
    				.attr("fill", function(d) { return arc_color(d.pkts / arc_max_value); })
    				.style("opacity", function(d) { return arc_opacity(d.pkts); });
    			svg_links.style("display", null);
    		});
			
		var arc_color = d3.interpolateRgb("#0064cd", "#c43c35");
		var arc_max_value = d3.max(nodes, function(d) { return d.pkts; });
		var arc_scale = d3.scale.linear().range([r0+70, r]).domain([0, arc_max_value]);
		var arc_opacity = d3.scale.linear().range([0.1, 0.6]).domain([0, arc_max_value]);
		var arc = d3.svg.arc()
			.innerRadius(r0)
			.outerRadius(function(d) { return arc_scale(d.pkts); })
			.startAngle(function(d, i) {
				var prev;
				if(i == 0) {
					prev = nodes[nodes.length-1];
				}
				else {
					prev = nodes[i-1];
				}
				
				var angle;
				if(prev.x > d.x) {
					angle = (d.x + prev.x - 360) / 2;
					if(angle < 0) {
						angle += 360;
					}
				}
				else {
					angle = (d.x + prev.x) / 2;
				}
				
				return angle / 180 * Math.PI; 
			})
			.endAngle(function(d, i) { 
				var next;
				if(i == nodes.length-1) {
					next = nodes[0];
				}
				else {
					next = nodes[i+1];
				}
				
				var angle;
				if(next.x < d.x) {
					angle = (next.x + d.x + 360) / 2;
					if(angle > 360) {
						angle -= 360;
					}
				}
				else {
					angle = (next.x + d.x) / 2;
				}
				
				return angle / 180 * Math.PI; 
			});
		svg_nodes.append("svg:path")
			.attr("class", "arc")
			.attr("d", arc)
			.attr("fill", function(d) { return arc_color(d.pkts / arc_max_value); })
			.style("opacity", function(d) { return arc_opacity(d.pkts); });
			
		svg_nodes.append("svg:text")
			.attr("dx", function(d) { return d.x < 180 ? 8 : -8; })
			.attr("dy", ".31em")
			.attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
			.attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 5) + ")" + (d.x < 180 ? "" : "rotate(180)"); })
			.text(function(d) { return d.name; });
			
		// Links
		var color = this.timeline.get("color");
		var line = d3.svg.line.radial()
			.interpolate("bundle")
			.tension(this.model.get("tension"))
			.radius(function(d) { return d.y; })
			.angle(function(d) { return d.x / 180 * Math.PI; });

		var links = [];
		var bundle_links = bundle(this.data_links);
		for(var i = 0; i < this.data_links.length; i++) {
			links.push({
				link: this.data_links[i],
				bundle: bundle_links[i]
			});
		}
		
		svg_defs.append("linearGradient")
			.attr("id", "arc_gradient")
			.call(function(gradient) {
				gradient.append("stop")
					.attr("offset", "0%")
					.attr("stop-color", arc_color(0))
					.attr("stop-opacity", arc_opacity(0));
				gradient.append("stop")
					.attr("offset", "100%")
					.attr("stop-color", arc_color(1))
					.attr("stop-opacity", arc_opacity(arc_max_value));
			});

		var svg_links = this.svg.selectAll("path.link")
			.data(links)
		.enter().append("path")
			.attr("class", "link")
			.attr("d", function(d) { return line(d.bundle); })
			.attr("stroke", function(d) { return color(d.link.t); });
			
		var svg_legend = this.svg.append("svg:g")
			.attr("class", "legend")
			.attr("transform", "translate(" + (r - 80) + "," + (r - 20) + ")");
		svg_legend.append("svg:rect")
			.attr("width", 20)
			.attr("height", 10)
			.attr("fill", "url(#arc_gradient)");
		svg_legend.append("svg:text")
			.attr("dx", 30)
			.attr("dy", 10)
			.text("# pakets");
			
		$(".node", this.el).twipsy({ 
			delayIn: 1000, 
			offset: 3, 
			html: true
		});
			
		return this;
    },
    updateNodes: function() {
    	if(this.nodes.length <= 0) {
    		return;
    	}
    	
    	var that = this;
    	var group_bytes = this.model.get("groupBytes");
    	var node_limit = this.model.get("nodeLimit");
    	this.node_map = {};
    	this.data_nodes = { name: "root", parent: null };
    	// create special "other" node
    	var other_nodes = { 
    		name: "others",
    		parent: this.data_nodes, 
    		bytes: 0, 
    		flows: 0, 
    		pkts: 0, 
    		nodes: 0 };
    	
    	var nodes = [];
    	this.nodes.each(function(node) {
    		nodes.push(node);
    	});
    	
    	if(node_limit) {
    		// sort nodes by number of flows descending if there is a node limit
    		nodes.sort(function(a,b) {
    			return b.get("flows") - a.get("flows");
    		});
    	}
    	
    	// insert nodes into tree (generates the tree on the fly)
    	function insert_node(node) {
			var pos = that.data_nodes;
			for(var i = 3; i >= group_bytes; i--) {
				var id = node.id >>> (i*8),
					name = FlowInspector.ipToStr(id << (i*8));
					
				if(i > 0) {
					name += "/" + (32-i*8);
				}
				
				if(!pos.children) {
					pos.children = [];
				}
				
				var child = null;
				for(var j = 0; j < pos.children.length; j++) {
				    if(pos.children[j].name === name) {
				    	child = pos.children[j];
				    	break;
				    }
				}
				
				if(!child) {
				    child = { 
				    	name: name, 
				    	parent: pos, 
				    	flows: 0, 
				    	bytes: 0,
				    	pkts: 0};
				    if(i === 0) {
				    	child["model"] = node;
				    }
				    pos.children.push(child);
				}
				
				// sum up values
				child.flows += node.get("flows");
				child.bytes += node.get("bytes");
				child.pkts += node.get("pkts");
				
				pos = child;
			}
			
			that.node_map[node.id] = child;
		}
		
		nodes.forEach(function(node, i) {
			if(!node_limit || i < node_limit) {
				insert_node(node);
			}
			else {
				// add node to other nodes
				other_nodes.nodes++;
				other_nodes.flows += node.get("flows");
				other_nodes.bytes += node.get("bytes");
				other_nodes.pkts += node.get("pkts");
				that.node_map[node.id] = other_nodes;
			}
		});
		
		if(node_limit) {
			this.data_nodes.children.push(other_nodes);
		}
    },
    updateFlows: function() {
    	if(!this.data_nodes) {
    		this.updateNodes();
    	}
    	
    	var that = this;
    	this.data_links = [];
    	
    	var min_bucket = d3.min(this.flows.models, function(d) { return d.get("bucket"); });
    	var max_bucket = d3.max(this.flows.models, function(d) { return d.get("bucket"); });

			this.flows.each(function(m) {
				var source = that.node_map[m.get("srcIP")];
				var target = that.node_map[m.get("dstIP")];
				var t = 1.0;
				if(min_bucket < max_bucket) {
					t = (m.get("bucket").getTime() - min_bucket.getTime()) / (max_bucket.getTime() - min_bucket.getTime());
				}
				
				// filter flows with target = source
				if(target !== source) {
					that.data_links.push({
						source: source,
						target: target,
						model: m,
						t: t
					});
				}
			});
		
			this.render();
    },
    tensionChanged: function(model, tension) {
    	if(!this.svg) {
    		return;
    	}
    	
    	var line = d3.svg.line.radial()
			.interpolate("bundle")
			.tension(tension)
			.radius(function(d) { return d.y; })
			.angle(function(d) { return d.x / 180 * Math.PI; });
			
		this.svg.selectAll("path.link")
			.attr("d", function(d) { return line(d.bundle); });
    },
    groupBytesChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    },
    nodeLimitChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    }
});