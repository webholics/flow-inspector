var PageView = Backbone.View.extend({
    hide: function() {
    	$(this.el).hide();
    	return this;
    },
    show: function() {
		$(this.el).show(); 
		return this;  
    }
});