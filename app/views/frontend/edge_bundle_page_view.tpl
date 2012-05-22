<script type="text/template" id="edge-bundle-page-template">
	<div class="container-fixed dark page-edge-bundle">
	    <aside id="sidebar" class="well">
	    	<h5>Layout</h5>
	    	<form class="form-stacked">
	    		<fieldset>
	    			<div class="clearfix help"
	    				title="Tension"
	    				data-content="Configure the how strong the flows are bundled together.">
	    				<label for="layoutTension">Tension</label>
	    				<input id="layoutTension" type="range" value="0" max="1" min="0" step="0.01" />
	    			</div>
	    		</fieldset>
	    	</form>
	    	<h5>Interaction</h5>
	    	<form class="form-stacked">
	    		<fieldset>
                    <div class="clearfix help"
		    			title="Hover Direction"
		    			data-content="Choose which direction of flows has to be shown when mouse hovers over a node.">
		    		    <select id="hoverDirection">
		    				<option value="outgoing">outgoing</option>
		    				<option value="incoming">incoming</option>
		    				<option value="both">both</option>
		    			</select>
	    			</div>
                </fieldset>
            </form>
	    	<h5>Filters</h5>
	    	<form class="form-stacked">
	    		<fieldset>
	    			<div class="clearfix help"
	    				title="Node limit"
	    				data-content="Limit the number of nodes. Nodes are sorted by the number of flows that belong to them. Then only the first n nodes will be shown individually. The others will be grouped together.">
	    				<label for="filterNodeLimit">Node limit</label>
	    				<select id="filterNodeLimit">
	    					<option value="0">unlimited</option>
	    					<option value="10">10</option>
	    					<option value="20">20</option>
	    					<option value="30">30</option>
	    					<option value="40">40</option>
	    					<option value="50">50</option>
	    					<option value="100">100</option>
	    					<option value="150">150</option>
	    					<option value="200">200</option>
	    					<option value="300">300</option>
	    					<option value="400">400</option>
	    					<option value="500">500</option>
	    					<option value="1000">1000</option>
	    				</select>
	    			</div>
	    			<div class="clearfix help"
	    				title="Group IP Bytes"
	    				data-content="Group least significant bytes of IPs together to reduce number of nodes in graph.">
	    				<label for="filterGroupBytes">Group IP Bytes</label>
	    				<select id="filterGroupBytes">
	    					<option value="0">0 bytes (no grouping)</option>
	    					<option value="1">1 byte</option>
	    					<option value="2">2 bytes</option>
	    					<option value="3">3 bytes</option>
	    				</select>
	    			</div>
	    			<div class="help"
		    			title="Port filter"
		    			data-content="Filter flows by port numbers. Enter one port number per line. Ports can be included in the visualization which means only the listed ports will be shown. Or they can be excluded which means only flows that don't contain such a port number are shown.">
		    			<div class="clearfix">
		    				<label for="filterPorts">Ports</label>
		    				<textarea id="filterPorts" rows="10"></textarea>
		    			</div>
		    			<div class="clearfix">
		    				<select id="filterPortsType">
		    					<option value="inclusive">include only listed ports</option>
		    					<option value="exclusive">exclude listed ports</option>
		    				</select>
		    			</div>
	    			</div>
	    		</fieldset>
	    	</form>
	    </aside>
	    <div id="content" class="content">
	    	<div class="canvas"></div>
	    </div>
	    <footer id="footbar" class="well">
	    </footer>
	</div>
</script>