import Foundation
import Capacitor
import EventKit

@objc(CalendarBridge)
public class CalendarBridge: CAPPlugin {
    private let store = EKEventStore()

    // Wichtig: CAPPlugin bietet eine Basis-Implementation -> override + public
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        store.requestAccess(to: .event) { granted, error in
            if let error = error {
                call.reject("perm error: \(error.localizedDescription)")
                return
            }
            call.resolve(["granted": granted])
        }
    }

    @objc public func getCalendars(_ call: CAPPluginCall) {
        let cals = store.calendars(for: .event).map { cal in
            [
                "id": cal.calendarIdentifier,
                "title": cal.title,
                "source": cal.source.title,
                "isSubscribed": cal.isSubscribed,
                "allowsModifications": cal.allowsContentModifications
            ] as [String : Any]
        }
        call.resolve(["calendars": cals])
    }

    @objc public func getEvents(_ call: CAPPluginCall) {
        guard let fromIso = call.getString("from"),
              let toIso   = call.getString("to") else {
            call.reject("missing from/to"); return
        }

        let ids = call.getArray("calendarIds", String.self) ?? []
        let f1 = ISO8601DateFormatter(); f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let f2 = ISO8601DateFormatter()

        guard let start = f1.date(from: fromIso) ?? f2.date(from: fromIso),
              let end   = f1.date(from: toIso)   ?? f2.date(from: toIso) else {
            call.reject("bad date"); return
        }

        let cals = ids.isEmpty ? nil : store.calendars(for: .event).filter { ids.contains($0.calendarIdentifier) }
        let pred = store.predicateForEvents(withStart: start, end: end, calendars: cals)
        let events = store.events(matching: pred).map { ev -> [String: Any] in
            [
                "id": ev.eventIdentifier,
                "title": ev.title ?? "",
                "notes": ev.notes ?? "",
                "location": ev.location ?? "",
                "allDay": ev.isAllDay,
                "start": f2.string(from: ev.startDate),
                "end":   f2.string(from: ev.endDate),
                "calendar": [
                    "id": ev.calendar.calendarIdentifier,
                    "title": ev.calendar.title,
                    "source": ev.calendar.source.title
                ]
            ]
        }.sorted { ($0["start"] as? String ?? "") < ($1["start"] as? String ?? "") }

        call.resolve(["events": events])
    }

    @objc public func addEvent(_ call: CAPPluginCall) {
        guard let title    = call.getString("title"),
              let startIso = call.getString("start"),
              let endIso   = call.getString("end") else {
            call.reject("missing title/start/end"); return
        }

        let f = ISO8601DateFormatter()
        guard let s = f.date(from: startIso),
              let e = f.date(from: endIso) else {
            call.reject("bad date"); return
        }

        let ev = EKEvent(eventStore: store)
        ev.title = title
        ev.startDate = s
        ev.endDate = e
        ev.location = call.getString("location") ?? ""
        ev.notes = call.getString("notes") ?? ""
        ev.isAllDay = call.getBool("allDay") ?? false

        if let cid = call.getString("calendarId"),
           let cal = store.calendar(withIdentifier: cid) {
            ev.calendar = cal
        } else {
            ev.calendar = store.defaultCalendarForNewEvents
        }

        do {
            try store.save(ev, span: .thisEvent, commit: true)
            call.resolve(["id": ev.eventIdentifier ?? ""])
        } catch {
            call.reject("save failed: \(error.localizedDescription)")
        }
    }

    @objc public func updateEvent(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let ev = store.event(withIdentifier: id) else {
            call.reject("event not found"); return
        }

        if let v = call.getString("title")    { ev.title = v }
        if let v = call.getString("notes")    { ev.notes = v }
        if let v = call.getString("location") { ev.location = v }
        if let v = call.getBool("allDay")     { ev.isAllDay = v }

        let f = ISO8601DateFormatter()
        if let v = call.getString("start"), let d = f.date(from: v) { ev.startDate = d }
        if let v = call.getString("end"),   let d = f.date(from: v) { ev.endDate = d }
        if let cid = call.getString("calendarId"),
           let cal = store.calendar(withIdentifier: cid) { ev.calendar = cal }

        do {
            try store.save(ev, span: .thisEvent, commit: true)
            call.resolve(["ok": true])
        } catch {
            call.reject("update failed: \(error.localizedDescription)")
        }
    }

    @objc public func deleteEvent(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let ev = store.event(withIdentifier: id) else {
            call.reject("event not found"); return
        }
        do {
            try store.remove(ev, span: .thisEvent, commit: true)
            call.resolve(["ok": true])
        } catch {
            call.reject("delete failed: \(error.localizedDescription)")
        }
    }
}
