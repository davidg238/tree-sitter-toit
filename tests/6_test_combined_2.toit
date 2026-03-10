main:
  result := ntp.synchronize
  if result:
    print "ntp: $result.adjustment ±$result.accuracy"
    esp32.adjust_real_time_clock result.adjustment

  task:: wait_on_jag false
  task:: monitor_tph
