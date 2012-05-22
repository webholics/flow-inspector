var GraphPageView = PageView.extend({
    events: {
    	"click a.reset": "clickLayoutReset",
    	"click a.force": "clickLayoutForce",
    	"click a.hilbert": "clickLayoutHilbert",
    	"change #filterNodeLimit": "changeNodeLimit",
    	"blur #filterPorts": "changeFilterPorts",
    	"change #filterPortsType": "changeFilterPortsType"
    },
    initialize: function() {
    	this.template = _.template($("#graph-page-template").html());
    	this.loaderTemplate = _.template($("#loader-template").html());
    
    	var that = this;
    	// make function available to unbind later
    	this._onResize = function() { that.render(); };
    	$(window).bind("resize", this._onResize);
    	
    	this.nodes = new IndexQuery(null, { index: "nodes" });
    	this.flows = new Flows();
    	this.timelineModel = new TimelineModel();
    	this.graphModel = new GraphModel();
    	
    	this.timelineView = new TimelineView({
    		model: this.timelineModel
    	});
    	this.graphView = new GraphView({
    		nodes: this.nodes,
    		flows: this.flows,
    		timeline: this.timelineModel,
    		model: this.graphModel
    	});
    	
    	// bind after initialization of GraphView to get event after the GraphView instance
    	this.nodes.bind("reset", this.updateIfLoaded, this);
    	this.flows.bind("reset", this.updateIfLoaded, this);
    	
    	this.timelineModel.bind("change:interval", this.changeBucketInterval, this);
    	this.graphModel.bind("change:nodeLimit", this.nodeLimitChanged, this);
    	this.graphModel.bind("change:filterPorts", this.filterPortsChanged, this);
    	this.graphModel.bind("change:filterPortsType", this.filterPortsTypeChanged, this);
    	
    	// fetch at the end because a cached request calls render immediately!
    	this.nodes.fetch();
    },
    remove: function() {
    	
    	if(this.timelineView) {
    		this.timelineView.remove();
    	}
    	if(this.graphView) {
    		this.graphView.remove();
    	}
    	
    	$(window).unbind("resize", this._onResize);
    	$(this.el).remove();
    	return this;
    },
    render: function() {
    	$(this.el).html(this.template());
    		
    	this.loader = $(this.loaderTemplate());
    	$(".content", this.el).append(this.loader);
    	
    	this.contentScrollApi = $(".content .scroll", this.el)
    		.jScrollPane()
    		.data("jsp");
    	this.asideScrollApi = $("aside", this.el)
    		.jScrollPane()
    		.data("jsp");
    			
    	$("#footbar", this.el).append(this.timelineView.el);
    	// rewire events because we removed the view from the dom
    	this.timelineView.delegateEvents();
    	this.timelineView.render();
    	
    	$(".canvas", this.el).append(this.graphView.el);
    	// rewire events because we removed the view from the dom
    	this.graphView.delegateEvents();
    	this.graphView.render();
    	
    	this.updateIfLoaded();
    	
    	// form defaults
    	$("#filterNodeLimit", this.el).val(this.graphModel.get("nodeLimit"));
    	$("#filterPorts", this.el).val(this.graphModel.get("filterPorts"));
    	$("#filterPortsType", this.el).val(this.graphModel.get("filterPortsType"));
    	
    	$("aside .help", this.el).popover({ offset: 24 });
    	
    	return this;
    },
    hide: function() {
    	this.graphView.stop();
    	
    	$(window).unbind("resize", this._onResize);
    	
    	return PageView.prototype.hide.call(this);
    },
    show: function() {
    	$(window).bind("resize", this._onResize);
    	return PageView.prototype.show.call(this);
    },
    updateIfLoaded: function() {
    	if(!$(this.el).html()) {
    		this.render();
    	}
    	
    	if(this.nodes.length <= 0) {
    		$(".btn", this.el).addClass("disabled");
    		return this;
    	}
    	
    	$(".btn", this.el).removeClass("disabled");
    	
    	this.loader.hide();
    	
    	this.contentScrollApi.reinitialise();
    	this.contentScrollApi.scrollToPercentX(0.5);
    	this.contentScrollApi.scrollToPercentY(0.5);
    	
    	return this;
    },
    fetchFlows: function() {
    	var interval = this.timelineModel.get("interval");
    	var bucket_size = this.timelineModel.get("bucket_size");
    	var filter_ports = $.trim(this.graphModel.get("filterPorts"));
    	var filter_ports_type = this.graphModel.get("filterPortsType");
    	
    	var data = { 
    		"fields": "srcIP,dstIP",
    		"start_bucket": Math.floor(interval[0].getTime() / 1000),
    		"end_bucket": Math.floor(interval[1].getTime() / 1000),
    		"bucket_size": bucket_size,
    		"biflow": 1
    	};
    	
    	
    	var ports = filter_ports.split("\n");
    	filter_ports = "";
    	for(var i = 0; i < ports.length; i++) {
    			var p = parseInt(ports[i]);
    			// test for NaN
    			if(p === p) {
    				if(filter_ports.length > 0) {
    					filter_ports += ",";
    				}
    				filter_ports += p;
    			}
    	}
    	
    	if(filter_ports) {
    		if(filter_ports_type === "exclusive") {
    			data["exclude_ports"] = filter_ports;
    		}
    		else {
    			data["include_ports"] = filter_ports;
    		}
    	}
    	
    	this.flows.fetch({ data: data });
    },
    changeBucketInterval: function(model, interval) {
    	this.loader.show();
    	this.fetchFlows();
    },
    clickLayoutReset: function() {
    	if(this.nodes.length <= 0 || this.flows.length <= 0) {
    		return;
    	}
    	this.graphView.forceLayout(true);
    },
    clickLayoutForce: function() {
    	if(this.nodes.length <= 0 || this.flows.length <= 0) {
    		return;
    	}
    	this.graphView.forceLayout();
    },
    clickLayoutHilbert: function() {
    	if(this.nodes.length <= 0 || this.flows.length <= 0) {
    		return;
    	}
    	this.graphView.hilbertLayout();
    },
    changeNodeLimit: function() {
    	this.graphModel.set({
    		nodeLimit: Number($("#filterNodeLimit", this.el).val())
    	});
    },
    nodeLimitChanged: function(model, value) {
    	$("#filterNodeLimit", this.el).val(value);
    },
    changeFilterPorts: function() {
    	this.graphModel.set({
    		filterPorts: $("#filterPorts", this.el).val()
    	});
    },
    filterPortsChanged: function(model, value) {
    	$("#filterPorts", this.el).val(value);
    	this.loader.show();
    	this.fetchFlows();
    },
    changeFilterPortsType: function() {
    	this.graphModel.set({
    		filterPortsType: $("#filterPortsType", this.el).val()
    	});
    },
    filterPortsTypeChanged: function(model, value) {
    	$("#filterPortsType", this.el).val(value);
    	this.loader.show();
    	this.fetchFlows();
    }
});