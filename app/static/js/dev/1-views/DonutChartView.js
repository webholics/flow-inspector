var DonutChartView = Backbone.View.extend({
	className: "donut-chart",
    events: {},
    initialize: function() {
    	if(!this.model) {
    		this.model = new DonutChartModel();
    	}
    	
    	this.model.bind("change:value", this.render, this);
    	this.model.bind("change:index", this.changeIndex, this);
    	
    	this.loaderTemplate = _.template($("#loader-template").html());
    	
    	this.index = new IndexQuery(null, { index: this.model.get("index") });
    	this.index.bind("reset", this.render, this);
    	// fetch at the end because a cached request calls render immediately!
    	this.index.fetch();
    },
    render: function() {
    	var container = $(this.el).empty();
    	
    	var num_val = this.model.get("value");
    	
    	var w = container.width(),
    		h = w,
    		r1 = Math.min(w, h) / 3.5,
    		r0 = r1 * .6,
    		labelr = r1 + 10,
    		color = d3.scale.category20(),
			arc = d3.svg.arc().innerRadius(r0).outerRadius(r1),
			donut = d3.layout.pie()
				.value(function(d) { return d.get(num_val, 0); });
    	
    	// check if container was removed from DOM	
    	if(w <= 0) {
    		return;
    	}
		
    	var data = this.index.models;
    	// sort data
    	data.sort(function(a,b) {
    		return b.get(num_val, 0) - a.get(num_val, 0);
    	});
    	
        var data = this.index.models;
     	// sort data
        data.sort(function(a,b) {
     		return b.get(num_val, 0) - a.get(num_val, 0);
     	});
     	
     	if(data.length > 31) {
            var others = data[30].clone();
            others.id = -1;
            for(var i = 31; i < data.length; i++) {
                others.attributes[num_val] += data[i].attributes[num_val];
            }
            var data = data.slice(0,30);
            data[30] = others;
        }
		
		// A SVG element.
    	var svg = d3.select(container.get(0))
    	.append("svg:svg")
    		.attr("width", w)
    		.attr("height", h);
    		
    	// no data there yet, show loader
    	if(data.length === 0) {
    		container.append(this.loaderTemplate());
    		return;
    	}

    	var group = svg.selectAll("g.arc")
			.data(donut(data))
		.enter().append("svg:g")
			.attr("class", "arc")
			.attr("transform", "translate(" + (w/2) + "," + (h/2) + ")");
			
		var getLabel;
		if(this.model.get("index") === "nodes") {
			getLabel = function(d) { 
                if(d.data.id > 0) return FlowInspector.ipToStr(d.data.id); 
                else return "others";
            }
		}
		else {
			getLabel = function(d) { 
                if(d.data.id) return d.data.id; 
                else if(d.data.id === -1) return "others";
                else return "unknown"
            }
		}
			
		group.append("svg:path")
			.attr("fill", function(d, i) { return color(i); })
			.attr("d", arc)
		group.append("svg:text")
			.text(getLabel)
			.attr("style", function(d) { if(Math.abs(d.endAngle - d.startAngle) < 0.05) return "display:none;"; })
			.attr("transform", function(d) {
			    var c = arc.centroid(d),
			        x = c[0],
			        y = c[1],
			        // pythagorean theorem for hypotenuse
			        h = Math.sqrt(x*x + y*y);
			    var translate = "translate(" + (x/h * labelr) + ',' + (y/h * labelr) +  ")";
			    var rotate = (d.endAngle + d.startAngle)/2/Math.PI*180;
			    if((d.endAngle + d.startAngle)/2 > Math.PI) {
			    	rotate += 90;
			    }
			    else {
			    	rotate -= 90;
			    }
			    
			    return translate + "rotate(" + rotate + ")";
			})
			.attr("text-anchor", function(d) {
			    // are we past the center?
			    return (d.endAngle + d.startAngle)/2 > Math.PI ?
			        "end" : "start";
			});
			
		return this;
    },
    changeIndex: function(model, value) {
    	this.index.index = value;
    	this.index.fetch();
    }
});