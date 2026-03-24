/**
 * Settings page: sync form with localStorage and save on Apply.
 */
(function() {
  function loadSettingsIntoForm() {
    try {
      var s = JSON.parse(localStorage.getItem('bezierVisualizerSettings') || '{}');
      var o = s.opacity != null ? s.opacity : 0.6;
      var r = s.tubeRadius != null ? s.tubeRadius : 0.4;
      var c = s.curveColor != null ? s.curveColor : '#EE4950';
      var sp = s.rotationSpeed != null ? s.rotationSpeed : 0.01;
      $('#setting-opacity').val(o);
      $('#setting-opacity-value').text(o);
      $('#setting-tube-radius').val(r);
      $('#setting-tube-radius-value').text(r);
      $('#setting-curve-color').val(c);
      $('#setting-rotation-speed').val(sp);
      $('#setting-rotation-speed-value').text(sp);
    } catch (_) {}
  }

  $(function() {
    loadSettingsIntoForm();
    $('#setting-opacity').on('input', function() {
      $('#setting-opacity-value').text($(this).val());
    });
    $('#setting-tube-radius').on('input', function() {
      $('#setting-tube-radius-value').text($(this).val());
    });
    $('#setting-rotation-speed').on('input', function() {
      $('#setting-rotation-speed-value').text($(this).val());
    });
    $('#settings-apply').on('click', function() {
      var settings = {
        opacity: parseFloat($('#setting-opacity').val(), 10),
        tubeRadius: parseFloat($('#setting-tube-radius').val(), 10),
        curveColor: $('#setting-curve-color').val(),
        rotationSpeed: parseFloat($('#setting-rotation-speed').val(), 10)
      };
      localStorage.setItem('bezierVisualizerSettings', JSON.stringify(settings));
      document.body.dispatchEvent(new CustomEvent('bezierApplySettings', { detail: settings }));
    });
  });
})();
