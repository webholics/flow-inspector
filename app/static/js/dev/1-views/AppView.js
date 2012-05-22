var AppView = Backbone.View.extend({
    events: {
    	"click .topbar .brand": "brandClick",
    	"click .topbar .primary-nav li a": "navigationClick",
    	"click .topbar .export": "clickSVGExport",
    	"click #select-svg-overlay": "clickSVGExportOverlay"
    },
    initialize: function(options) {
    	this.bd = $("#bd");
    	this.model.bind("change:page", this.changePage, this);
    	this.router = options.router;
    	this.pages = {};
    	this.currentPage = null;
    	
    	this.pageViews = {
    		"dashboard": DashboardPageView,
   		 	"graph": GraphPageView,
   		 	"edge-bundle": EdgeBundlePageView,
   		 	"hive-plot": HivePlotPageView
    	};
    },
    render: function() {
    	var pageName = this.model.get("page");
    	
    	$(".topbar .nav li").removeClass("active");
    	$(".topbar .nav li." + pageName).addClass("active");
    	
    	$('.topbar').dropdown();
    	
    	this.currentPage = this.getPage(pageName);
    	
    	return this;
    },
    changePage: function(model, value) {
    	$(".topbar .nav li").removeClass("active");
    	$(".topbar .nav li." + value).addClass("active");
    	
    	if(this.currentPage) {
    		this.currentPage.hide();
    	}
    	
    	this.currentPage = this.getPage(value).show().render();
    },
    brandClick: function(e) {
    	e.preventDefault();
    	this.model.set({page: "dashboard"});
    	this.router.navigate("/");
    },
    navigationClick: function(e) {
    	e.preventDefault();
    	
    	var li = $(e.target).parent();
    	if(!li.hasClass("active")) {
    		this.model.set({page: li.attr("class")});
    	}
    	this.router.navigate($(e.target).attr("href"));
    },
    getPage: function(name) {
    	if(this.pages[name]) {
    		return this.pages[name];
    	}
    	var page = new this.pageViews[name]();
    	this.pages[name] = page;
    	this.bd.append(page.el);
    	page.render();
    	return page;
    },
    clickSVGExport: function(e) {
    	var that = this;
    	$(this.el).on("mousemove.export", function(e) {
    		that.selectSVGMouseMove(e);
    	});
    },
    selectSVGMouseMove: function(e) {
    	var overlay = $("#select-svg-overlay").hide();
    	
    	var target = $(document.elementFromPoint(e.pageX, e.pageY));
    	if(target[0].nodeName.toLowerCase() !== "svg") {
    		target = target.parents("svg");
    	}
    	
    	if(target.length === 0) {
    		$("#select-svg-overlay").hide();
    		return;
    	}
    	
    	this.svgExportTarget = target[0];
    	
    	// we can't use jQuery offset() here because there is a bug with SVG
    	var box = { 
    		top: 0, 
    		left: 0, 
    		width: target.outerWidth(),
    		height: target.outerHeight() 
    	};
    	var parent = target[0];
    	do {
    		if($(parent).css("overflow") === "hidden") {
	    		if(box.top < 0) {
	    			box.top = 0;
	    		}
	    		if(box.top + box.height > parent.offsetHeight) {
	    			box.height = parent.offsetHeight - box.top;
	    			if(box.height < 0) {
	    				box.height = 0;
	    			}
	    		}
    		}
    		box.top += parent.offsetTop;
    		
    		if($(parent).css("overflow") === "hidden") {
	    		if(box.left < 0) {
	    			box.left = 0;
	    		}
	    		if(box.left + box.width > parent.offsetWidth) {
	    			box.width = parent.offsetWidth - box.left;
	    			if(box.left < 0) {
	    				box.left = 0;
	    			}
	    		}
    		}
    		box.left += parent.offsetLeft;
    	} while(parent = parent.offsetParent);
    	
    	$("#select-svg-overlay")
    		.show()
    		.css("left", box.left)
    		.css("top", box.top)
    		.width(box.width)
    		.height(box.height);
    },
    clickSVGExportOverlay: function(e) {
    	$(this.el).off("mousemove.export");
    	$("#select-svg-overlay").hide();
    	
    	if(!this.svgExportTarget) {
    		return;
    	}
    	
    	var original_svg = $(this.svgExportTarget);
    	var svg = original_svg.clone();
    	// detach is important to keep all attached jquery data & events living
    	original_svg.after(svg).detach();
    		
    	svg.attr({ version: '1.1' , xmlns:"http://www.w3.org/2000/svg"});
    	
    	// this is really awesome code to retrieve all styles 
    	// of an element without the browser default styles
    	// (http://stackoverflow.com/questions/754607/can-jquery-get-all-css-styles-associated-with-an-element)
    	function css(a) {
    		var sheets = document.styleSheets, 
    			o = {};
    			
    		for(var i in sheets) {
    			var rules = sheets[i].rules || sheets[i].cssRules;
    			for(var r in rules) {
    				if(a.is(rules[r].selectorText)) {
    					o = $.extend(o, css2json(rules[r].style), css2json(a.attr('style')));
    				}
    			}
    		}
    		
    		return o;
		}
		
		function css2json(css) {
			var s = {};
			if(!css) return s;
			if(css instanceof CSSStyleDeclaration) {
				for(var i in css) {
					if((css[i]).toLowerCase) {
						s[(css[i]).toLowerCase()] = (css[css[i]]);
					}
				}
			} 
			else if(typeof css == "string") {
				css = css.split("; ");          
				for (var i in css) {
					var l = css[i].split(": ");
					s[l[0].toLowerCase()] = (l[1]);
				};
			}
		
			return s;
		}
    	
    	// make styles inline
    	svg.css(css(svg));
    	$("*", svg).each(function() {
    		$(this).css(css($(this)));
    	});
    	
		var bb = new BlobBuilder();
		bb.append((new XMLSerializer).serializeToString(svg[0]));
		var blob = bb.getBlob("application/svg+xml;charset=" + this.svgExportTarget.characterSet);
		saveAs(blob, "vis.svg");
		
		svg.after(original_svg).remove();
		
		this.svgExportTarget = null;
    }
});