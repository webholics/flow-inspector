var GraphView = Backbone.View.extend({
    events: {
    	"click": "stop"
    },
    initialize: function(options) {
    	if(!this.model) {
    		this.model = new GraphModel();
    	}
    	this.model.bind("change:nodeLimit", this.nodeLimitChanged, this);
    	
    	this.nodes = options.nodes;
    	this.flows = options.flows;
    	this.timeline = options.timeline;
    	this.nodes.bind("reset", this.updateNodes, this);
    	this.flows.bind("reset", this.updateFlows, this);
    	
    	this.w = 3000;
    	this.h = 3000;
    	
    	this.data_nodes = [];
    	this.data_links = [];
    },
    render: function() {
    	var container = $(this.el).empty();
    	
    	if(this.data_nodes.length <= 0) {
    		return;
    	}
    		
    	var svg = d3.select(container.get(0))
    	.append("svg")
			.attr("width", this.w)
			.attr("height", this.h);
		
		// stop old force otherwise this could be very CPU intensive
		if(this.force) {
			this.force.stop();
		}
		this.force = d3.layout.force()
			.charge(-120)
			.gravity(0.15)
			.linkDistance(30)
			.nodes(this.data_nodes)
			.links(this.data_links)
			.size([this.w, this.h]);
			
		var color = this.timeline.get("color");
		
		var link = svg.selectAll("line.link")
			.data(this.data_links)
		.enter().append("line")
			.attr("class", "link")
			//.style("stroke-width", function(d) { return Math.sqrt(d.value); })
			.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; })
			.attr("stroke", function(d) { return color(d.t); });

		var node = svg.selectAll("circle.node")
			.data(this.data_nodes)
		.enter().append("circle")
			.attr("class", "node")
			.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; })
			.attr("r", function(d) { 
				if(d.name === "others") 
					return 6; 
				return 3; 
			})
			.style("fill", "#fff")
			.attr("title", function(d) { 
				if(d.name === "others") 
					return d.name + " (" + d.nodes + " nodes)";
				return d.name; 
			});
			//.call(force.drag);
			
		this.force.on("tick", function(e) {
			link.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

			node.attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
		});
		
		$(".node", this.el).twipsy({ delayIn: 1000, offset: 3 });
		
		return this;
    },
    updateNodes: function() {
    	if(this.nodes.length <= 0) {
    		return;
    	}
    	
    	this.data_nodes = [];
    	this.node_map = {};
    	var node_limit = this.model.get("nodeLimit");
    	// create special "other" node
    	var other_nodes = { 
    		name: "others", 
    		bytes: 0, 
    		flows: 0, 
    		pkts: 0, 
    		nodes: 0 };
    	var that = this;
    	
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
    	
		nodes.forEach(function(m, i) {
			if(!node_limit || i < node_limit) {
				var node = {
					name: FlowInspector.ipToStr(m.id),
					model: m
				};
				that.data_nodes.push(node);
				that.node_map[m.id] = node;
			}
			else {
				// add node to other nodes
				other_nodes.nodes++;
				other_nodes.flows += m.get("flows");
				other_nodes.bytes += m.get("bytes");
				other_nodes.pkts += m.get("pkts");
				that.node_map[m.id] = other_nodes;
			}
		});
		
		// sort nodes by IP ascending
		// this is important for hilbert curves
		this.data_nodes.sort(function(a, b) {
			return a.model.id - b.model.id;
		});
		
		if(node_limit) {
			this.data_nodes.push(other_nodes);
		}
    	
    	this.render();
    	
    	this.hilbertLayout();
    },
    updateFlows: function() {
    	if(this.data_nodes.length <= 0) {
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
			
			that.data_links.push({
				source: source,
				target: target,
				model: m,
				t: t
			});
		});
		
		this.render();
    },
    stop: function() {
    	if(this.force) {
    		this.force.stop();
    	}
    	return this;
    },
    forceLayout: function(reset) {
    	if(this.data_nodes.length <= 0 || this.data_links.length <= 0) {
    		return this;
    	}
    	
    	this.stop();
    	
    	if(reset) {
    		this.data_nodes.forEach(function(n) {
    			delete n.x;
    			delete n.y;
    		});
    	}
    	
    	this.force.start();
    	return this;
    },
    hilbertLayout: function() {
    	if(this.data_nodes.length <= 0) {
    		return this;
    	}
    	
    	this.stop();
    	
    	var hilbertW = 500,
    		hilbertH = 500,
    		n = 2;
		for(; n*n < this.data_nodes.length; n *= 2);
		
		for(var i = 0; i < this.data_nodes.length; i++) {
			var p = FlowInspector.hilbertD2XY(n, i);
			this.data_nodes[i].x = (p.x + 0.5) / n * hilbertW;
			this.data_nodes[i].y = (p.y + 0.5) / n * hilbertH;
		}
		
		// compute center
		var mx = 0,
			my = 0;
		for(var i = 0; i < this.data_nodes.length; i++) {
			mx += this.data_nodes[i].x;
			my += this.data_nodes[i].y;
		}
		mx /= this.data_nodes.length;
		my /= this.data_nodes.length;
		
		for(var i = 0; i < this.data_nodes.length; i++) {
			this.data_nodes[i].x += this.w/2 - mx;
			this.data_nodes[i].y += this.h/2 - my;
		}
		
		var container = $(this.el)
		d3.select(container.get(0)).selectAll(".link")
			.transition()
			.duration(1000)
			.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		d3.select(container.get(0)).selectAll(".node")
			.transition()
			.duration(1000)
			.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; });
    	
    	return this;
    },
    nodeLimitChanged: function(model, value) {
    	this.updateNodes();
    	this.updateFlows();
    }
});