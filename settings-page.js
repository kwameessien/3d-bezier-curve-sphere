/**
 * Settings page: sync form with localStorage, draw a live preview plate,
 * and save on Apply (then open the visualizer).
 */
(function() {
  var BS = window.BezierSphere;
  var PRESET_COLORS = ['#E0464E', '#141414', '#2F5BEA', '#C8902E', '#2E8B6A'];

  // Paints the filled part of a range track (styles.css reads --fill)
  function paintRange($input) {
    var el = $input[0];
    var pct = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  function readForm() {
    var choice = $('input[name="curve-color"]:checked').val();
    return {
      opacity: parseFloat($('#setting-opacity').val()),
      tubeRadius: parseFloat($('#setting-tube-radius').val()),
      curveColor: choice === 'custom' || !choice ? $('#setting-curve-color').val().toUpperCase() : choice,
      rotationSpeed: parseFloat($('#setting-rotation-speed').val()),
      theme: $('input[name="theme"]:checked').val() || 'paper',
      graticule: $('#setting-graticule').prop('checked')
    };
  }

  function loadSettingsIntoForm(s) {
    $('#setting-opacity').val(s.opacity);
    $('#setting-tube-radius').val(s.tubeRadius);
    $('#setting-rotation-speed').val(s.rotationSpeed);
    var color = String(s.curveColor).toUpperCase();
    $('#setting-curve-color').val(color);
    $('input[name="curve-color"][value="' + (PRESET_COLORS.indexOf(color) >= 0 ? color : 'custom') + '"]').prop('checked', true);
    $('input[name="theme"][value="' + s.theme + '"]').prop('checked', true);
    $('#setting-graticule').prop('checked', !!s.graticule);
    refresh();
  }

  function refresh() {
    var s = readForm();
    $('#setting-opacity-value').text(s.opacity.toFixed(2));
    $('#setting-tube-radius-value').text(s.tubeRadius.toFixed(1));
    $('#setting-rotation-speed-value').text(s.rotationSpeed.toFixed(3));
    $('input[type="range"]').each(function() { paintRange($(this)); });
    $('.swatch--custom span').css('background', $('input[value="custom"]').prop('checked') ? s.curveColor : '');

    var theme = BS.THEMES[s.theme];
    $('#preview-figure').css('background', theme.bg);
    var p = BS.PRESETS[0];
    $('#preview').html(BS.plateSVG({
      routes: [[p.a, p.b]],
      style: 'shaded',
      size: 480,
      step: s.graticule ? 15 : 0,
      stroke: 0.6,
      color: s.curveColor,
      width: 1.5 + s.tubeRadius * 4,
      opacity: 0.35 + s.opacity * 0.65,
      theme: s.theme,
      label: 'Preview of the globe with current settings'
    }));
  }

  $(function() {
    loadSettingsIntoForm(BS.loadSettings());

    $('#settings-form').on('input change', refresh);

    // Picking the custom swatch opens the native colour picker
    $('input[name="curve-color"][value="custom"]').on('click', function() {
      $('#setting-curve-color').trigger('click');
    });
    $('#setting-curve-color').on('input change', function() {
      $('input[name="curve-color"][value="custom"]').prop('checked', true);
      refresh();
    });

    $('#settings-apply').on('click', function() {
      if (BS.saveSettings(readForm())) {
        window.location.href = 'visualizer.html';
      } else {
        $('#settings-status').addClass('error').text('Could not save — browser storage is unavailable.');
      }
    });

    $('#settings-reset').on('click', function() {
      loadSettingsIntoForm(BS.DEFAULT_SETTINGS);
      BS.saveSettings(readForm());
      $('#settings-status').removeClass('error').text('Defaults restored.');
    });
  });
})();
