Pod::Spec.new do |s|
  s.name         = 'CalendarBridge'
  s.version      = '1.0.0'
  s.summary      = 'Capacitor native Calendar bridge (EventKit)'
  s.description  = 'Local pod to expose EventKit to Capacitor via CAP_PLUGIN.'
  s.homepage     = 'https://sv-schumann.de'
  s.license      = { :type => 'MIT', :text => 'local use' }
  s.author       = { 'SV Schumann' => 'info@sv-schumann.de' }
  s.platform     = :ios, '13.0'
  s.swift_version = '5.0'

  # Wichtig: Wir hängen uns in das App-Target als Source an
  s.source       = { :path => '.' }
  s.source_files = 'Sources/**/*.{swift,m,h}'
  s.requires_arc = true

  # Abhängigkeiten
  s.dependency 'Capacitor', '>= 5.0' # oder deine Cap-Version, z.B. 6.x
end
