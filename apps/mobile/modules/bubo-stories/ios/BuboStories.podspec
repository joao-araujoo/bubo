Pod::Spec.new do |s|
  s.name = 'BuboStories'
  s.version = '1.0.0'
  s.summary = 'Local Bubo Story image sharing'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED', :text => 'All rights reserved.' }
  s.author = 'Bubo'
  s.homepage = 'https://github.com/joao-araujoo/bubo'
  s.platform = :ios, '16.4'
  s.source = { :git => 'https://github.com/joao-araujoo/bubo.git' }
  s.static_framework = true
  s.swift_version = '5.0'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit', 'Photos', 'ImageIO'
  s.source_files = 'BuboStoriesModule.swift'
end
