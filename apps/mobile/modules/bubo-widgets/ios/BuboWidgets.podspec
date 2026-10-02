Pod::Spec.new do |s|
  s.name = 'BuboWidgets'
  s.version = '1.0.0'
  s.summary = 'Official Bubo system widgets'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED', :text => 'All rights reserved.' }
  s.author = 'Bubo'
  s.homepage = 'https://github.com/joao-araujoo/bubo'
  s.platform = :ios, '16.4'
  s.source = { :git => 'https://github.com/joao-araujoo/bubo.git' }
  s.static_framework = true
  s.swift_version = '5.0'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'
  s.source_files = 'BuboWidgetsModule.swift'
end
