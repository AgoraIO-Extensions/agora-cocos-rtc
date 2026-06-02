#!/opt/homebrew/opt/ruby/bin/ruby
# frozen_string_literal: true

ENV['GEM_HOME'] ||= '/opt/homebrew/Cellar/cocoapods/1.16.2_1/libexec'
default_gem_paths = `/opt/homebrew/opt/ruby/bin/gem env gempath`.strip
ENV['GEM_PATH'] ||= "#{ENV['GEM_HOME']}:#{default_gem_paths}"

require 'rubygems'
Gem.use_paths(ENV['GEM_HOME'], ENV['GEM_PATH'].split(':'))
require 'json'
require 'xcodeproj'

REPO_ROOT = File.expand_path('..', __dir__)
SDK_CONFIG = JSON.parse(
  File.read(File.join(REPO_ROOT, 'sdk/agora-rtc/sdk-config.json'))
)
PROJECT_PATH = File.join(REPO_ROOT, 'example/basic-call/build-ios/ios/proj/agora-cocos-basic-call.xcodeproj')
APP_DELEGATE_PATH = File.join(REPO_ROOT, 'example/basic-call/native/engine/ios/AppDelegate.mm')
GROUP_NAME = 'agora-rtc'
PACKAGE_URL = SDK_CONFIG.fetch('ios').fetch('packageUrl')
PACKAGE_VERSION = SDK_CONFIG.fetch('ios').fetch('packageVersion')
PACKAGE_PRODUCT = SDK_CONFIG.fetch('ios').fetch('packageProduct')
TARGET_NAME = 'agora-cocos-basic-call-mobile'
WITH_PACKAGE = ARGV.include?('--with-package')
IOS_BUNDLE_ID = ENV['IOS_BUNDLE_ID']
IOS_DEVELOPMENT_TEAM = ENV['IOS_DEVELOPMENT_TEAM']
IOS_PROVISIONING_PROFILE_SPECIFIER = ENV['IOS_PROVISIONING_PROFILE_SPECIFIER']

APP_DELEGATE_FORWARD_DECLARATION = <<~OBJC.strip
  @interface AgoraRtcPlugin : NSObject
  + (instancetype)sharedInstance;
  - (void)attachBridge;
  @end
OBJC
APP_DELEGATE_ATTACH_CALL = '    [[AgoraRtcPlugin sharedInstance] attachBridge];'

def ensure_app_delegate_attaches_bridge(path)
  return unless File.exist?(path)

  content = File.read(path)
  patched = content.dup

  unless patched.include?('@interface AgoraRtcPlugin : NSObject')
    import_anchor = '#import "service/SDKWrapper.h"'
    patched = if patched.include?(import_anchor)
                patched.sub(import_anchor, "#{import_anchor}\n\n#{APP_DELEGATE_FORWARD_DECLARATION}")
              else
                "#{APP_DELEGATE_FORWARD_DECLARATION}\n\n#{patched}"
              end
  end

  unless patched.include?('[[AgoraRtcPlugin sharedInstance] attachBridge]')
    launch_anchor = '[appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];'
    raise 'Unable to patch iOS AppDelegate: launch anchor not found.' unless patched.include?(launch_anchor)

    patched = patched.sub(launch_anchor, "#{launch_anchor}\n#{APP_DELEGATE_ATTACH_CALL}")
  end

  File.write(path, patched) if patched != content
end

project = Xcodeproj::Project.open(PROJECT_PATH)
target = project.targets.find { |candidate| candidate.name == TARGET_NAME }
raise "Target not found: #{TARGET_NAME}" unless target

group = project.main_group.find_subpath(GROUP_NAME, true)
group.set_source_tree('<group>')
group.path = GROUP_NAME

['AgoraRtcBridge.swift', 'AgoraRtcPlugin.mm', 'AgoraEngineTextureSlotBridge.h', 'AgoraEngineTextureSlotBridge.mm'].each do |filename|
  file_ref = group.files.find { |file| file.path == filename } || group.new_file(filename)
  target.add_file_references([file_ref])
end

target.build_configurations.each do |configuration|
  swift_version = configuration.build_settings['SWIFT_VERSION']
  if swift_version.nil? || swift_version.to_s.strip.empty?
    configuration.build_settings['SWIFT_VERSION'] = SDK_CONFIG.fetch('ios').fetch('swiftVersion')
  end

  configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = IOS_BUNDLE_ID if IOS_BUNDLE_ID && !IOS_BUNDLE_ID.empty?

  if IOS_DEVELOPMENT_TEAM && !IOS_DEVELOPMENT_TEAM.empty?
    configuration.build_settings['DEVELOPMENT_TEAM'] = IOS_DEVELOPMENT_TEAM
    configuration.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  end

  if IOS_PROVISIONING_PROFILE_SPECIFIER && !IOS_PROVISIONING_PROFILE_SPECIFIER.empty?
    configuration.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = IOS_PROVISIONING_PROFILE_SPECIFIER
    configuration.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  end
end

package_ref = project.root_object.package_references.find do |reference|
  reference.isa == 'XCRemoteSwiftPackageReference' && reference.repositoryURL == PACKAGE_URL
end
package_product = target.package_product_dependencies.find do |dependency|
  dependency.product_name == PACKAGE_PRODUCT
end

frameworks_phase = target.frameworks_build_phase

if WITH_PACKAGE
  unless package_ref
    package_ref = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
    package_ref.repositoryURL = PACKAGE_URL
    package_ref.requirement = {
      'kind' => 'exactVersion',
      'version' => PACKAGE_VERSION,
    }
    project.root_object.package_references << package_ref
  end

  unless package_product
    package_product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    package_product.package = package_ref
    package_product.product_name = PACKAGE_PRODUCT
    target.package_product_dependencies << package_product
  end

  unless frameworks_phase.files.any? { |file| file.product_ref == package_product }
    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = package_product
    frameworks_phase.files << build_file
  end
else
  frameworks_phase.files
    .select { |file| file.product_ref && file.product_ref.display_name == PACKAGE_PRODUCT }
    .each(&:remove_from_project)

  if package_product
    target.package_product_dependencies.delete(package_product)
    package_product.remove_from_project
  end

  if package_ref
    project.root_object.package_references.delete(package_ref)
    package_ref.remove_from_project
  end
end

project.save
ensure_app_delegate_attaches_bridge(APP_DELEGATE_PATH)
puts "Integrated Agora bridge files into #{PROJECT_PATH}"
