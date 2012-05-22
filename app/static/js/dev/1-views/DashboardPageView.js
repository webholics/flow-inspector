var DashboardPageView = PageView.extend({
    events: {
    	"click .bucket-chart-value a": "clickBucketChartValue",
    	"click .donut-chart-value a": "clickDonutChartValue"
    },
    initialize: function() {
    	this.template = _.template($("#dashboard-page-template").html());
    	
    	this.bucketChartModel = new BucketChartModel();
    	this.bucketChartModel.bind("change:value", this.changeBucketChartValue, this);
    	this.bucketChartView = new BucketChartView({ model: this.bucketChartModel });
    	
    	this.nodesDonutModel = new DonutChartModel({ index: "nodes" });
    	this.nodesDonutModel.bind("change:value", this.changeDonutChartValue, this);
	  	this.nodesDonutView = new DonutChartView({ model: this.nodesDonutModel });
    	
    	this.portsDonutModel = new DonutChartModel({ index: "ports" });
	   	this.portsDonutView = new DonutChartView({ model: this.portsDonutModel });
    },
    render: function() {
    	$(this.el).html(this.template());
    	
    	$(".bucket-chart-value li[data-value='" + this.bucketChartModel.get("value") + "']", this.el)
    		.addClass("active");
    	$(".donut-chart-value li[data-value='" + this.nodesDonutModel.get("value") + "']", this.el)
    		.addClass("active");
    	
    	$(".viz-buckets", this.el).append(this.bucketChartView.el);
    	$(".viz-donut-nodes", this.el).append(this.nodesDonutView.el);
    	$(".viz-donut-ports", this.el).append(this.portsDonutView.el);
    	
	    this.bucketChartView.render();
	    this.nodesDonutView.render();
	    this.portsDonutView.render();
	    
	    return this;
    },
    clickBucketChartValue: function(e) {
    	var target = $(e.target).parent();
    	this.bucketChartModel.set({ value: target.data("value") });
    },
    clickDonutChartValue: function(e) {
    	var target = $(e.target).parent();
    	this.nodesDonutModel.set({ value: target.data("value") });
    	this.portsDonutModel.set({ value: target.data("value") });
    },
    changeBucketChartValue: function(model, value) {
    	$(".bucket-chart-value li", this.el).removeClass("active");
    	$(".bucket-chart-value li[data-value='" + value + "']", this.el)
    		.addClass("active");
    },
    changeDonutChartValue: function(model, value) {
    	$(".donut-chart-value li", this.el).removeClass("active");
    	$(".donut-chart-value li[data-value='" + value + "']", this.el)
    		.addClass("active");
    }
});