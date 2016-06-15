
String.prototype.scalar2surrogatePair = function(){
	var i, hi, lo, result = [];
	for (i=0; i<this.length; i+=2) {
		hi = this.charCodeAt(i);
		lo = this.charCodeAt(i + 1);
		if (!lo) {
			result.push(hi.toString(16));
			break;
		}
		// unicode surrogate pair to scalar
		if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) {
			result.push(
				(((hi - 0xd800) * 0x400) + (lo - 0xdc00) + 0x10000).
					toString(16)
			);
		} else {
			result.push(hi.toString(16), lo.toString(16));
		}
	}
	return result.join('-');
};

angular.module('snapcapt', [
]).filter('unisp', function(){
	return function(u) {
		return u.scalar2surrogatePair();
	};
}).controller('ScTop', function($scope, $http){

	var s = $scope;

	s.dim = {
		w: 480,
		h: 480,
	};

	s.style = null;
	s.dataURL = null;
	s.img = {
		w: 480,
		h: 480,
	};

	s.minDim = 48;
	s.maxDim = 2048;

	s.emoji = {
		grp: [],
		ico: {},
		active: null,
		range: null,
		// TODO: use images if glyphs not available
		withImage: true,
		imgPath: 'https://assets-cdn.github.com/images/icons/emoji/unicode',
	};

	s.isEditing = true;
	s.isMoving = false;

	s.load = function() {

		// SVG style text
		$http.get('./snap.css').then(function(ret) {
			s.style = ret.data;
		});

		// emoji list
		$http.get('./emoji.json').then(function(ret) {
			var data = ret.data;

			s.emoji.active = 1;
			data.forEach(function(e, i){
				//if (i === 0)
				//	return;
				s.emoji.grp.push([i, e[0].split(' - ')[0].trim()]);
				s.emoji.ico[i] = [];
				e[1].forEach(function(p){
					s.emoji.ico[i].push(p);
				});
			});
		});

		// uploader
		$('#pic-upload').on('change', function(ev){
			ev.stopPropagation();
			ev.preventDefault();
			s.loadImg(ev);
		});
		$('#preview')[0].addEventListener('drop', function(ev){
			ev.stopPropagation();
			ev.preventDefault();
			s.loadImg(ev);
		}, false);
		$('#preview')[0].addEventListener('dragover', function(ev){
			ev.stopPropagation();
			ev.preventDefault();
			ev.dataTransfer.dropEffect = 'copy';
		});

		// SVG
		var svg = d3.select('#preview').
				attr('width', s.dim.w).
				attr('height', s.dim.h);

		s.imageSVG = d3.select('#image-svg').
				attr('width', s.img.w).
				attr('height', s.img.h);

		var zoom = function(dir) {
			// zoom image on mousewheel
			if (!s.isMoving)
				return;
			var dw = 8, dh = 8,
			    ele = s.imageSVG,
			    sw = parseInt(ele.attr('width')),
			    sh = parseInt(ele.attr('height'));
			if (dir > 0) {
				dw*= -1;
				dh*= -1;
			}
			sw+= dw;
			sh+= dh;
			if (sw < s.minDim|| sh < s.minDim|| sw > s.maxDim || sh > s.maxDim)
				return;
			s.imageSVG.attr('width', sw).attr('height', sh);
		};
		$('#image-svg').on('mousewheel DOMMouseScroll', function(ev){
			if (ev.type == 'mousewheel')
				// webkit
				zoom(ev.originalEvent.wheelDelta);
			else
				// gecko
				zoom(ev.originalEvent.detail);
		});

		$('#image-svg').on('dblclick', function(ev){
			// reset to original size
			s.imageSVG.
				attr('width', s.img.w).
				attr('height', s.img.h).
				attr('x', 0).
				attr('y', 0);
		});

		s.imageSVG.on('mousedown', function(){
			// move image
			if (!s.isMoving || !s.dataURL)
				return;
			var ele = s.imageSVG, win,
			    po = d3.mouse(ele.node()), qo,
			    dx, dy;
			ele.classed('moving', true);
			win = d3.select(window).on('mousemove', function(){
				qo = d3.mouse(ele.node());
				if (qo[0] <= 0 || qo[0] > s.dim.w || qo[1] <= 0 || qo[1] > s.dim.h)
					return;
				dx = po[0] - qo[0];
				dy = po[1] - qo[1];
				s.imageSVG.
					attr('x', parseInt(ele.attr('x')) - dx).
					attr('y', parseInt(ele.attr('y')) - dy);
				po = qo;
			}).on('mouseup', function(){
				win.on('mousemove', null).
					on('mouseup', null);
				ele.classed('moving', false);
			});
			d3.event.preventDefault();
		});

		var cap = $('#caption'),
		    mh = cap.height(),
		    sy, ny, y, win;

		var fo = d3.select('#caption-container').
			attr('x', 0).
			attr('y', s.dim.h / 2).
			attr('width', s.dim.w).
			attr('height', mh);

		d3.select(cap[0]).on('mousedown', function(){
			// move caption up and down
			if (!s.isMoving)
				return;
			sy = d3.mouse(fo.node())[1];
			$(cap).addClass('moving');
			win = d3.select(self).on('mousemove', function(){
				ny = d3.mouse(fo.node())[1];
				dy = sy - ny;
				y = parseInt(fo.attr('y')) - dy;
				if (y < 0 || y > s.dim.h - mh)
					return;
				fo.attr('y', y);
				sy = ny;
			}).on('mouseup', function(){
				win.on('mousemove', null).
					on('mouseup', null);
				$(cap).removeClass('moving');
			});
			d3.event.preventDefault();
		});

		s.range = null;
		var storeRange = function() {
			// save selection in cap.range
			var sel = self.getSelection();
			if (sel.getRangeAt && sel.rangeCount) {
				s.range = sel.getRangeAt(0);
			}
		};
		// use 'selectstart' for Firefox >= 43
		cap.on('mouseup', function(){ storeRange(); });
		cap.on('keyup', function(){ storeRange(); });
		cap.on('keydown', function(ev){
			// prevent <Enter>
			if (ev.keyCode === 13)
				return false;
			return true;
		});

		// watcher
		s.$watch('isEditing', function(){
			s.render();
		});
		s.$watch('dataURL', function(n){
			if (n !== null)
				s.imageSVG.attr('xlink:href', n);
		});
		s.$watch('isMoving', function(n){
			var cap = $('#caption');
			if (!n)
				cap.removeClass('move');
			else
				cap.addClass('move');
		});
	};

	s.load();

	s.insertEmoji = function(tx) {
		var cap = $('#caption');

		// only on editing
		if (!s.isEditing)
			return;

		cap.focus();

		var range, span, sel = self.getSelection();

		if (!sel)
			// unsupported browser
			return;

		// remove non-saved ranges
		sel.removeAllRanges();

		if (s.range) {
			// from pre-selection
			range = s.range;
		} else if (sel.getRangeAt && sel.rangeCount) {
			// from beginning
			range = sel.getRangeAt(0);
			range.deleteContents();
		} else {
			// unsupported browser
			return;
		}

		// delete selected
		range.deleteContents();

		// insert saved range
		sel.addRange(range);

		// insert emoji inside span
		span = range.createContextualFragment(
			'<span>' + tx + '</span>');
		span.innerHTML = tx;
		range.insertNode(span);

		// collapse selection to end
		range.collapse(false);

		// save new range
		s.range = range.cloneRange();

	};

	/**
	 * Render SVG to PNG.
	 */
	s.render = function() {

		var w = self.URL || self.webkitURL || self;
		var ele = $('#preview')[0];
		var stl = 'data:text/css;base64,' + self.btoa(s.style);

		var data = new XMLSerializer().serializeToString(ele);
		data = '<' + '?xml version="1.0" standalone="no"?' + '>' +
			   '<' + '?xml-stylesheet type="text/css" href="' + stl + '"?' + '>' +
			   '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
		           '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
			   data;

		var svg = new Blob([data], {type: 'image/svg+xml;charset=utf-8'}),
		    url = w.createObjectURL(svg);

		var img = new Image();
		img.onload = function() {
			var cv = $('#render')[0],
			    ct = cv.getContext('2d');
			cv.width = s.dim.w;
			cv.height = s.dim.h;
			ct.clearRect(0, 0, s.dim.w, s.dim.h);
			ct.drawImage(img, 0, 0);
			//w.revokeObjectURL(url);

			var svg = $('#result-svg')[0],
			    png = $('#result-png')[0];
			svg.download = 'result.svg';
			png.download = 'result.png';
			if (cv.toBlob) {
				s.hasBlob = true;
				// Chrome >= 50
				cv.toBlob(function(blob) {
					svg.href = url;
					png.href = w.createObjectURL(blob);
				});
			} else {
				s.hasBlob = false;
				// not supported
			}
		};
		img.src = url;
	};

	s.loadImg = function(ev) {
		var reader = new FileReader(), fl;
		if (ev.dataTransfer) {
			var ed = ev.dataTransfer;
			if (ed.getData && ed.getData('URL').match(/^https?:/i)) {
				// drag and drop from a URL
				s.loadImgRemote(ed.getData('URL'));
				return false;
			} else if (ed.files) {
				// drag and drop to any element
				fl = ed.files[0];
			}
		} else {
			// change to input[type=file] element
			fl = ev.target.files[0];
		}
		if (!fl)
			return false;
		if (!fl.type.match(/^image\//))
			return false;
		var rescale = function(w, h) {
			if (w <= s.maxDim && h <= s.maxDim)
				return [w, h];
			if (w > h) {
				h = s.maxDim * h / w;
				w = s.maxDim;
			} else {
				w = s.maxDim * w / h;
				h = s.maxDim;
			}
		};
		reader.onload = function(ef){
			s.$apply(function(){
				s.dataURL = ef.target.result;
				var img = new Image(), rsc;
				img.src = s.dataURL;
				img.onload = function(){
					try {
						rsc = rescale(img.width, img.height);
						s.img.w = rsc[0];
						s.img.h = rsc[1];
						s.imageSVG.
							attr('width', s.img.w).
							attr('height', s.img.h).
							attr('x', 0).
							attr('y', 0);
					} catch(err) {}
				};
				s.isMoving = false;
			});
		};
		reader.readAsDataURL(fl);
	};

	/**
	 * Load remote image and draw it to canvas.
	 */
	s.loadImgRemote = function(url) {
		var pt = $('#loader-image')[0],
		    cv = $('#loader-canvas')[0],
		    ct = cv.getContext('2d');
		pt.src = url;
		pt.onload = function(){
			cv.width = pt.width;
			cv.height = pt.height;
			ct.clearRect(0, 0, pt.width, pt.height);
			ct.drawImage(pt, 0, 0, pt.width, pt.height);
			s.$apply(function(){
				try {
					s.dataURL = cv.toDataURL('image/png');
					s.isMoving = false;
				} catch(e) {
					// CORS error
				}
			});
		};
	};

});

