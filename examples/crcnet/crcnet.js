var labelType, useGradients, nativeTextSupport, animate;

(function() {
  var ua = navigator.userAgent,
      iStuff = ua.match(/iPhone/i) || ua.match(/iPad/i),
      typeOfCanvas = typeof HTMLCanvasElement,
      nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'),
      textSupport = nativeCanvasSupport 
        && (typeof document.createElement('canvas').getContext('2d').fillText == 'function');
  //I'm setting this based on the fact that ExCanvas provides text support for IE
  //and that as of today iPhone/iPad current text support is lame
  labelType = (!nativeCanvasSupport || (textSupport && !iStuff))? 'Native' : 'HTML';
  nativeTextSupport = labelType == 'Native';
  useGradients = nativeCanvasSupport;
  animate = !(iStuff || !nativeCanvasSupport);
})();

function init(){
  // init data
  jQuery.getJSON('data/crc.json', function(data) {
    var json = [];
    
    jQuery.each(data, function(index, obj) {
      var host = {}, parents;

      jQuery.each(obj, function(key, val) {
        switch(key) {
          case 'alias': 
            //host['name'] = val;
            break;
          case 'address':
            break;
          case 'host_name':
            host['id'] = val;
            host['name'] = val;
            break;
          case 'parents':
            parents = val.split(',');
            host['adjacencies'] = [];
            jQuery.each(parents, function(index, p) {
              host['adjacencies'].push({ nodeTo: p });
            });
            break;
          default:
        }
      });
      
      if (host.id)
        json.push(host);
    });

    makeViz(json);
  });
  
  function makeViz(json) {
    //implement a new node type  
    $jit.NetworkMap.Plot.NodeTypes.implement({  
      'groups': {  
        'render': function(node, canvas) {  
          this.nodeHelper.circle.render 
        },  
        'contains': function(node, pos) {  
          this.nodeHelper.circle.contains
        }  
      }  
    });  

    // end
    // init ForceDirected
    var fd = new $jit.NetworkMap({
      injectInto: 'infovis',
      Navigation: {
        enable: true,
        panning: true, //'avoid nodes',
        zooming: 40 //zoom speed. higher is more sensible
      },
      Node: {
        overridable: true,
        dim: 4
      },
      Edge: {
        overridable: true,
        color: '#23A4FF',
        lineWidth: 1,
        type: 'arrowpipe'
      },
      //Native canvas text styling
      Label: {
        type: 'HTML', //Native or HTML
        // TODO: can't move nodes properly with HTML labels - may need to overide navigation class
        size: 10,
        style: 'bold'
      },
      // Add node events
      Events: {
        enable: true,
        type: 'Native', // use the default events system
        onMouseMove: function(node, eventInfo, e) {
          var edge = eventInfo.getEdge();

          if (this.current) this.current.remove();
          if (!edge) return;

          var n1 = edge.nodeFrom,
              n2 = edge.nodeTo,
              n1f = fd.fitsInCanvas(fd.p2c(n1.getPos())),
              n2f = fd.fitsInCanvas(fd.p2c(n2.getPos()));
          
          if (n1f && n2f || !n1f && !n2f) {
            return;
          }

          var to = n1f ? n2 : n1;
          var from = n1f ? n1 : n2;

          this.current = jQuery('<div>To ' + to.name + '</div>')
            .css({ position: 'absolute', left: e.clientX, top: e.clientY - 30, color: '#ddd' })
            .appendTo(document.body);
        },
        onMouseWheel: function() {
        },
        //Change cursor style when hovering a node
        onMouseEnter: function() {
          fd.canvas.getElement().style.cursor = 'move';
        },
        onMouseLeave: function() {
          fd.canvas.getElement().style.cursor = '';
        },
        //Update node positions when dragged
        onDragMove: function(node, eventInfo, e) {
          //var pos = eventInfo.getPos();  
          //node.pos.setc(pos.x, pos.y);  
          //fd.plot();  
        },
        //Implement the same handler for touchscreens
        onTouchMove: function(node, eventInfo, e) {
          //$jit.util.event.stop(e); //stop default touchmove event
          //this.onDragMove(node, eventInfo, e);
        },
        //Add also a click handler to nodes
        onClick: function(node, eventInfo, e) {
          var edge = eventInfo.getEdge();
          
          if (edge) {
            var edge = eventInfo.getEdge();
            
            if (!edge) return;

            var n1 = edge.nodeFrom,
                n2 = edge.nodeTo,
                n1f = fd.fitsInCanvas(fd.p2c(n1.getPos())),
                n2f = fd.fitsInCanvas(fd.p2c(n2.getPos()));
            
            if (n1f && n2f || !n1f && !n2f) {
              return;
            }

            var from = n1f ? n1 : n2;
            var to = n1f ? n2 : n1;

            fd.followEdge(from, to, 2);
            }
        }
      },
      //Number of iterations for the FD algorithm
      layout: 'Static',
      bgAlpha: 0.25,
      groupLvls: [ 0 ],
      onCreateLabel: function(domElement, node){
        var style = domElement.style;
        domElement.innerHTML = node.id;
        style.fontSize = "0.8em";
        style.color = "#ddd";
        style.whiteSpace= "nowrap";
      },
      onPlaceLabel: function(domElement, node){
        var style = domElement.style;
        var left = parseInt(style.left);
        var top = parseInt(style.top);
        var w = domElement.offsetWidth;
        style.left = (left - w / 2) + 'px';
        style.top = top + 'px';
      }
    });
    
    $NetworkMap.Json.load('data/crcnet.json', function(json) {
      $NetworkMap.Utils.Metrics.initJSON(json);
      fd.loadJSON(json);
      $NetworkMap.Utils.Metrics.updateMetrics(fd);
      
      // debug test
      //var debug = new $NetworkMap.Debug.GraphicalOutput(fd);
      //debug.enable();

      fd.refresh();
      fd.canvas.scale(2.5, 2.5);

      // overview test
      var over = new $NetworkMap.Views.OverviewManager(fd, jQuery('#overview'), 180, 150, { Node: { dim: 5 } });
      
      /*var button = jQuery('<input id="btnSave" type="button" value="save" />').click(function() {
        jQuery.each(fd.json, function(index, node) {
          var pos = fd.graph.getNode(node.id).getPos('current');
          if (!node.data) node.data = {};
          node.data.pos = { x: pos.x, y: pos.y };
        });

        $NetworkMap.Json.save('../../src/save.php', fd.json, 'crcnet.json');
      });
      jQuery(document.body).append(button);*/
    });  
  }
}
