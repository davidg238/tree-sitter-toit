
import gpio
import i2c
import bme280
import ntp

import gpio.adc
import esp32

import .sn_sender

/*
Refer to:
  https://docs.toit.io/tutorials/starter/temperature/
  https://github.com/toitlang/toit/blob/master/examples/triggers/gpio.toit
*/

WAKEUP_PIN ::= 32  // Use a pull-down resistor to pull pin 32 to ground.
GATEWAY ::= "192.168.0.130"  // Substitute with your MQTT-SN gateway

main:

  result ::= ntp.synchronize
  if result:
    print "ntp: $result.adjustment ±$result.accuracy"
    esp32.adjust_real_time_clock result.adjustment

  task:: wait_on_jag false
  task:: monitor_tph

  if esp32.wakeup_cause == esp32.WAKEUP_EXT1:
    wait_on_jag int
  else:
    monitor_tph
  init_wakeup_pin
  esp32.deep_sleep (Duration --m=1)

monitor_tph:
  bus := i2c.Bus
    --sda=gpio.Pin 21
    --scl=gpio.Pin 22
  
  device := bus.device 0x77
  bme := bme280.Driver device
  // voltage := adc.get * 2

  /*
  For development, deployed via JAG, so wait for WiFi connection:
  [wifi] DEBUG: connecting
  [wifi] DEBUG: connected
  [wifi] INFO: network address dynamically assigned through dhcp {ip: 192.168.0.245}
  */
  sleep --ms=20_000
  print "."
  print "Publishing via MQTT-SN to $GATEWAY:1885 on topics, \"t_\": $(%.1f bme.read_temperature), \"h_\": $(%.1f bme.read_humidity), \"p_\": $(%.1f bme.read_pressure/100)"
  // temperature in C, humidity in %, pressure in hPa

  client := SN_QoS3_Client --gateway=GATEWAY
  client.open
  client.publish "t_" "$(%.1f bme.read_temperature)"
  client.publish "h_" "$(%.1f bme.read_humidity)"
  client.publish "p_" "$(%.1f bme.read_pressure)"
  sleep --ms=10_000 // Appear to need time before closing the socket, to allow last message to flow.
  client.close
 
init_wakeup_pin:
  pin := gpio.Pin WAKEUP_PIN
  mask := 0
  mask |= 1 << pin.num
  esp32.enable_external_wakeup mask true

wait_on_jag jag_avail/bool:
  // Give the pin a chance to go low again and for JAG to connect
  print "Opening window for JAG connect ................."
  while jag_avail:
    sleep (Duration --m=1)
  print "................. closing window for JAG connect"


  // Battery voltage supported on Adafruit Huzzah32 https://learn.adafruit.com/adafruit-huzzah32-esp32-feather/pinouts 
  // adc := gpio.Adc (gpio.Pin 35)