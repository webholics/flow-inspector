if(!FlowInspector) {
	var FlowInspector = {};
}

/**
 * Transforms a 32bit IPv4 address into a human readable format
 * (e.g. 192.168.0.1)
 */
FlowInspector.ipToStr = function(ip) {
	return (ip >>> 24) + "." +
		   (ip >> 16 & 0xFF) + "." +
		   (ip >> 8 & 0xFF) + "." +
		   (ip & 0xFF);
};

/**
 * Transforms a human readable IPv4 address into a 32bit integer
 * (e.g. 192.168.0.1)
 */
FlowInspector.strToIp = function(str) {
	var parts = str.split(".");
	if(parts.length !== 4) {
		return false;
	}
	
	var ip = 0;
	for(var i = 0; i < 4; i++) {
		var j = parseInt(parts[i]);
		// check for range and Nan
		if(j !== j || j < 0 || j > 255) {
			return false;
		}
		ip = (ip << 8) + j;
	}
	return ip;
};

/**
 * Functions to work with Hilbert Curves.
 * (http://en.wikipedia.org/wiki/Hilbert_curve)
 */
 
//convert (x,y) to d
FlowInspector.hilbertXY2D = function(n, x, y) {
    var rx, ry, s, r, d = 0;
    for(s = n/2; s > 0; s /= 2) {
        rx = (x & s) > 0;
        ry = (y & s) > 0;
        d += s * s * ((3 * rx) ^ ry);
        r = FlowInspector.hilbertRot(s, x, y, rx, ry);
        x = r.x;
        y = r.y;
    }
    return d;
};
 
//convert d to (x,y)
FlowInspector.hilbertD2XY = function(n, d) {
    var rx, ry, s, r, t = d;
    var x = 0, y = 0;
    for(s = 1; s < n; s *= 2) {
        rx = 1 & (t/2);
        ry = 1 & (t ^ rx);
        r = FlowInspector.hilbertRot(s, x, y, rx, ry);
        x = r.x;
        y = r.y;
        x += s * rx;
        y += s * ry;
        t /= 4;
    }
    return { x: x, y: y };
};
 
//rotate/flip a quadrant appropriately
FlowInspector.hilbertRot = function(n, x, y, rx, ry) {
    var t;
    if(ry == 0) {
        if(rx == 1) {
            x = n-1 - x;
            y = n-1 - y;
        }
        t  = x;
        x = y;
        y = t;
    }
    return { x: x, y: y };
};