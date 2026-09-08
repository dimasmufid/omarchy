Pod::Spec.new do |s|
  s.name           = 'OmarchyLink'
  s.version        = '0.1.0'
  s.summary        = 'Pinned local transport for Omarchy Mobile'
  s.description    = 'Native TLS certificate pinning, file upload, and Bonjour discovery.'
  s.author         = 'Omarchy'
  s.homepage       = 'https://github.com/dimasmufid/omarchy'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
