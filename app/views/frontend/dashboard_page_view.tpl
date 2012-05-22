<script type="text/template" id="dashboard-page-template">
	<div class="container page-dashboard">
	    <div class="content">
	    	<div class="page-header">
		    	<h1>Dashboard</h1>
		    </div>
			<h2>Time series</h2>
			<ul class="pills bucket-chart-value">
				<li data-value="flows"><a href="javascript:void(0)"># Flows</a></li>
				<li data-value="pkts"><a href="javascript:void(0)"># Pakets</a></li>
				<li data-value="bytes"><a href="javascript:void(0)"># Bytes</a></li>
			</ul>
			<div class="viz-buckets"></div>
			<h2>Distribution of nodes and ports</h2>
			<ul class="pills donut-chart-value">
				<li data-value="flows"><a href="javascript:void(0)"># Flows</a></li>
				<li data-value="pkts"><a href="javascript:void(0)"># Pakets</a></li>
				<li data-value="bytes"><a href="javascript:void(0)"># Bytes</a></li>
			</ul>
			<div class="row">
				<div class="span8">
					<div class="viz-donut-nodes"></div>
				</div>
				<div class="span8">
					<div class="viz-donut-ports"></div>
				</div>
			</div>
	    </div>
	    <footer>
	    	<p>&copy; Mario Volke</p>
	    </footer>
	</div>
</script>