<!DOCTYPE HTML>
<html lang="en-US">
<head>
	<meta charset="UTF-8">
	<title>Flow Inspector</title>
	<meta name="description" content="Visualize and analyse IPFIX flows with Flow Inspector.">
    <meta name="author" content="Mario Volke">
    
    <link href="/static/css/dev/bootstrap.css" rel="stylesheet">
    <link href="/static/css/dev/jquery.jscrollpane.css" rel="stylesheet">
    <link href="/static/css/dev/screen.css" rel="stylesheet">
</head>
<body>

	<header class="topbar">
		<div class="topbar-inner">
			<div class="container-fluid">
				<a class="brand" href="/">Flow Inspector</a>
				<ul class="nav primary-nav">
					<li class="dashboard"><a href="/">Dashboard</a></li>
					<li class="graph"><a href="/graph">Graph</a></li>
					<li class="edge-bundle"><a href="/hierarchical-edge-bundle">Hierarchical Edge Bundle</a></li>
					<li class="hive-plot"><a href="/hive-plot">Hive Plot</a></li>
				</ul>
				
				<ul class="nav secondary-nav">
					<li class="dropdown">
						<a href="javascript:void(0)" class="dropdown-toggle">Actions</a>
						<ul class="dropdown-menu">
							<li><a class="export" href="javascript:void(0)">Export to SVG</a></li>
						</ul>
					</li>
				</ul>
			</div>
		</div>
	</header>
	
	
	<div class="alerts">
	    <!--<div class="alert-message warning">
	    	<a class="close" href="#">×</a>
	    	<p><strong>Holy guacamole!</strong> Best check yo self, you’re not looking too good.</p>
	    </div>-->
	</div>
    
    <div id="bd"></div>
    
    <div id="select-svg-overlay"><div><span>click</span><br />to save</div></div>
	
	{% for file in frontend_templates %}
		{% include file %}
	{% endfor %}
    
    {% for file in include_js %}
    	<script src="{{ file }}"></script>
    {% endfor %}
    
</body>
</html>