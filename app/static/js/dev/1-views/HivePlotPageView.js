var HivePlotPageView = PageView.extend({
    events: {
    	"change #mapNumericalValue": "changeNumericalValue",
    	"change #mapAxisScale": "changeAxisScale",
    	"blur #mapAxis1": "changeMapAxis1",
    	"blur #mapAxis2": "changeMapAxis2",
    	"blur #mapAxis3": "changeMapAxis3",
    	"blur #filterPorts": "changeFilterPorts",
    	"change #filterPortsType": "changeFilterPortsType",
    	"change #directionAxis1": "changeDirectionAxis1",
    	"change #directionAxis2": "changeDirectionAxis2",
    	"change #directionAxis3": "changeDirectionAxis3"
    },
    initialize: function() {
    	this.template = _.template($("#hive-plot-page-template").html());
    	this.loaderTemplate = _.template($("#loader-template").html());
    
    	var that = this;
    	// make function available to unbind later
    	this._onResize = function() { that.render(); };
    	$(window).bind("resize", this._onResize);
    	
    	this.nodes = new IndexQuery(null, { index: "nodes" });
    	this.flows = new Flows();
    	this.timelineModel = new TimelineModel();
    	this.hivePlotModel = new HivePlotModel();
    	
    	this.timelineView = new TimelineView({
    		model: this.timelineModel
    	});
    	this.hivePlotView = new HivePlotView({
    		nodes: this.nodes,
    		flows: this.flows,
    		timeline: this.timelineModel,
    		model: this.hivePlotModel
    	});
    	
    	// bind after initialization of HivePlotView to get event after the HivePlotView instance
    	this.nodes.bind("reset", this.updateIfLoaded, this);
    	this.flows.bind("reset", this.updateIfLoaded, this);
    	
    	this.timelineModel.bind("change:interval", this.changeBucketInterval, this);
    	this.hivePlotModel.bind("change:numericalValue", this.numericalValueChanged, this);
    	this.hivePlotModel.bind("change:axisScale", this.axisScaleChanged, this);
    	this.hivePlotModel.bind("change:mapAxis1", this.mapAxis1Changed, this);
    	this.hivePlotModel.bind("change:mapAxis2", this.mapAxis2Changed, this);
    	this.hivePlotModel.bind("change:mapAxis3", this.mapAxis3Changed, this);
    	this.hivePlotModel.bind("change:filterPorts", this.filterPortsChanged, this);
    	this.hivePlotModel.bind("change:filterPortsType", this.filterPortsTypeChanged, this);
    	this.hivePlotModel.bind("change:directionAxis1", this.directionAxis1Changed, this);
    	this.hivePlotModel.bind("change:directionAxis2", this.directionAxis2Changed, this);
    	this.hivePlotModel.bind("change:directionAxis3", this.directionAxis3Changed, this);
    	
    	// fetch at the end because a cached request calls render immediately!
    	this.nodes.fetch();
    },
    remove: function() {
    	
    	if(this.timelineView) {
    		this.timelineView.remove();
    	}
    	if(this.hivePlotView) {
    		this.hivePlotView.remove();
    	}
    	
    	$(window).unbind("resize", this._onResize);
    	$(this.el).remove();
    	return this;
    },
    render: function() {
    	$(this.el).html(this.template());
    		
    	this.loader = $(this.loaderTemplate());
    	$(".content", this.el).append(this.loader);
    	
    	this.asideScrollApi = $("aside", this.el)
    		.jScrollPane()
    		.data("jsp");
    			
    	$("#footbar", this.el).append(this.timelineView.el);
    	// rewire events because we removed the view from the dom
    	this.timelineView.delegateEvents();
    	this.timelineView.render();
    	
    	$(".canvas", this.el).append(this.hivePlotView.el);
    	// rewire events because we removed the view from the dom
    	this.hivePlotView.delegateEvents();
    	this.hivePlotView.render();
    	
    	this.updateIfLoaded();
    	
    	// form defaults
    	$("#mapNumericalValue", this.el).val(this.hivePlotModel.get("numericalValue"));
    	$("#mapAxisScale", this.el).val(this.hivePlotModel.get("axisScale"));
    	$("#mapAxis1").val(this.hivePlotModel.get("mapAxis1"));
    	$("#mapAxis2").val(this.hivePlotModel.get("mapAxis2"));
    	$("#mapAxis3").val(this.hivePlotModel.get("mapAxis3"));
    	$("#filterPorts", this.el).val(this.hivePlotModel.get("filterPorts"));
    	$("#filterPortsType", this.el).val(this.hivePlotModel.get("filterPortsType"));
    	$("#directionAxis1", this.el).val(this.hivePlotModel.get("directionAxis1"));
    	$("#directionAxis2", this.el).val(this.hivePlotModel.get("directionAxis2"));
    	$("#directionAxis3", this.el).val(this.hivePlotModel.get("directionAxis3"));
    	
    	$("aside .help", this.el).popover({ offset: 24 });
    	
    	return this;
    },
    hide: function() {
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
    	
    	this.loader.hide();
    	
    	return this;
    },
    fetchFlows: function() {
    	var interval = this.timelineModel.get("interval");
    	var bucket_size = this.timelineModel.get("bucket_size");
    	var filter_ports = $.trim(this.hivePlotModel.get("filterPorts"));
    	var filter_ports_type = this.hivePlotModel.get("filterPortsType");
    	
    	var data = { 
    		"fields": "srcIP,dstIP",
    		"start_bucket": Math.floor(interval[0].getTime() / 1000),
    		"end_bucket": Math.floor(interval[1].getTime() / 1000),
    		"bucket_size": bucket_size
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
    changeNumericalValue: function() {
    	this.hivePlotModel.set({
    		numericalValue: $("#mapNumericalValue", this.el).val()
    	});
    },
    numericalValueChanged: function(model, value) {
    	$("#mapNumericalValue", this.el).val(value);
    },
    changeAxisScale: function() {
    	this.hivePlotModel.set({
    		axisScale: $("#mapAxisScale", this.el).val()
    	});
    },
    axisScaleChanged: function(model, value) {
    	$("#mapAxisScale", this.el).val(value);
    },
    changeMapAxis1: function() {
    	this.hivePlotModel.set({
    		mapAxis1: $.trim($("#mapAxis1", this.el).val())
    	});
    },
    mapAxis1Changed: function(model, value) {
    	$("#mapAxis1", this.el).val(value);
    },
    changeMapAxis2: function() {
    	this.hivePlotModel.set({
    		mapAxis2: $.trim($("#mapAxis2", this.el).val())
    	});
    },
    mapAxis2Changed: function(model, value) {
    	$("#mapAxis2", this.el).val(value);
    },
    changeMapAxis3: function() {
    	this.hivePlotModel.set({
    		mapAxis3: $.trim($("#mapAxis3", this.el).val())
    	});
    },
    mapAxis3Changed: function(model, value) {
    	$("#mapAxis3", this.el).val(value);
    },
    changeFilterPorts: function() {
    	this.hivePlotModel.set({
    		filterPorts: $("#filterPorts", this.el).val()
    	});
    },
    filterPortsChanged: function(model, value) {
    	$("#filterPorts", this.el).val(value);
    	this.loader.show();
    	this.fetchFlows();
    },
    changeFilterPortsType: function() {
    	this.hivePlotModel.set({
    		filterPortsType: $("#filterPortsType", this.el).val()
    	});
    },
    filterPortsTypeChanged: function(model, value) {
    	$("#filterPortsType", this.el).val(value);
    	this.loader.show();
    	this.fetchFlows();
    },
    changeDirectionAxis1: function() {
    	this.hivePlotModel.set({
    		directionAxis1: $("#directionAxis1", this.el).val()
    	});
    },
    directionAxis1Changed: function(model, value) {
    	$("#directionAxis1", this.el).val(value);
    },
    changeDirectionAxis2: function() {
    	this.hivePlotModel.set({
    		directionAxis2: $("#directionAxis2", this.el).val()
    	});
    },
    directionAxis2Changed: function(model, value) {
    	$("#directionAxis2", this.el).val(value);
    },
    changeDirectionAxis3: function() {
    	this.hivePlotModel.set({
    		directionAxis3: $("#directionAxis3", this.el).val()
    	});
    },
    directionAxis3Changed: function(model, value) {
    	$("#directionAxis3", this.el).val(value);
    }
});