jQuery(function() {
    
    var appState = new AppState();
    
	var router = new MainRouter({
		model: appState
	});
	Backbone.history.start({pushState: true});
	
   var app = new AppView({
    	model: appState,
    	router: router,
    	el: document
    });
    app.render();
});