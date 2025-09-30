#import <Capacitor/Capacitor.h>

CAP_PLUGIN(CalendarBridge, "CalendarBridge",
  CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getCalendars, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getEvents, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(addEvent, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(updateEvent, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(deleteEvent, CAPPluginReturnPromise);
)
