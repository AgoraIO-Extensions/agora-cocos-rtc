#!/usr/bin/env ruby
# frozen_string_literal: true

require 'rbconfig'

def shell_output(*command)
  output = IO.popen(command, err: File::NULL, &:read).to_s.strip
  $?&.success? ? output : ''
end

def discover_cocoapods_paths
  pod_path = shell_output('which', 'pod')
  return [nil, nil] if pod_path.empty? || !File.file?(pod_path)

  pod_content = File.read(pod_path)
  gem_home = pod_content.match(/GEM_HOME="([^"]+)"/)&.[](1)
  pod_executable = pod_content.match(/\bexec\s+"([^"]+)"/)&.[](1)
  pod_executable = pod_path if pod_executable.nil? || pod_executable.empty?

  ruby_path = nil
  if File.file?(pod_executable)
    shebang = File.open(pod_executable, &:gets).to_s.strip
    ruby_path = shebang.match(/^#!\s*(\S+)/)&.[](1)
  end

  libexec = File.expand_path('../libexec', pod_path)
  gem_home ||= libexec if File.directory?(libexec)

  [gem_home, ruby_path]
end

def current_gem_command
  candidate = File.join(File.dirname(RbConfig.ruby), 'gem')
  File.executable?(candidate) ? candidate : 'gem'
end

cocoapods_gem_home, cocoapods_ruby = discover_cocoapods_paths
if ENV['AGORA_COCOS_RUBY_REEXEC'] != '1' &&
   cocoapods_ruby &&
   File.executable?(cocoapods_ruby) &&
   File.realpath(cocoapods_ruby) != File.realpath(RbConfig.ruby)
  env = ENV.to_h
  env['AGORA_COCOS_RUBY_REEXEC'] = '1'
  env['GEM_HOME'] ||= cocoapods_gem_home if cocoapods_gem_home && !cocoapods_gem_home.empty?
  exec(env, cocoapods_ruby, __FILE__, *ARGV)
end

ENV['GEM_HOME'] ||= cocoapods_gem_home if cocoapods_gem_home && !cocoapods_gem_home.empty?
default_gem_paths = shell_output(current_gem_command, 'env', 'gempath')
ENV['GEM_PATH'] ||= [ENV['GEM_HOME'], default_gem_paths].compact.reject(&:empty?).join(':')

require 'rubygems'
Gem.use_paths(ENV['GEM_HOME'], ENV['GEM_PATH'].split(':')) if ENV['GEM_HOME'] && !ENV['GEM_HOME'].empty?
require 'json'
require 'xcodeproj'

REPO_ROOT = File.expand_path('..', __dir__)
SDK_CONFIG = JSON.parse(
  File.read(File.join(REPO_ROOT, 'sdk/agora-rtc/sdk-config.json'))
)
PROJECT_PATH = File.join(REPO_ROOT, 'example/basic-call/build-ios/ios/proj/agora-cocos-basic-call.xcodeproj')
APP_DELEGATE_PATH = File.join(REPO_ROOT, 'example/basic-call/native/engine/ios/AppDelegate.mm')
INFO_PLIST_PATH = File.join(REPO_ROOT, 'example/basic-call/native/engine/ios/Info.plist')
COMMON_ENGINE_TEXTURE_BRIDGE_DIR = File.join(REPO_ROOT, 'example/basic-call/native/engine/common/Classes/agora')
GROUP_NAME = 'agora-rtc'
COMMON_GROUP_NAME = 'agora-engine-texture'
PACKAGE_URL = SDK_CONFIG.fetch('ios').fetch('packageUrl')
PACKAGE_VERSION = SDK_CONFIG.fetch('ios').fetch('packageVersion')
IOS_CONFIG = SDK_CONFIG.fetch('ios')
PACKAGE_PRODUCTS = if IOS_CONFIG['packageProducts'].is_a?(Array) && !IOS_CONFIG['packageProducts'].empty?
                     IOS_CONFIG['packageProducts']
                   else
                     [IOS_CONFIG.fetch('packageProduct')]
                   end
TARGET_NAME = 'agora-cocos-basic-call-mobile'
WITH_PACKAGE = ARGV.include?('--with-package')
SKIP_SIMULATOR_LAUNCH_ASSETS = ARGV.include?('--skip-simulator-launch-assets')
IOS_BUNDLE_ID = ENV['IOS_BUNDLE_ID']
IOS_DEVELOPMENT_TEAM = ENV['IOS_DEVELOPMENT_TEAM']
IOS_PROVISIONING_PROFILE_SPECIFIER = ENV['IOS_PROVISIONING_PROFILE_SPECIFIER']
IOS_CODE_SIGN_IDENTITY = ENV['IOS_CODE_SIGN_IDENTITY']

APP_DELEGATE_FORWARD_DECLARATION = <<~OBJC.strip
  @interface AgoraRtcPlugin : NSObject
  + (instancetype)sharedInstance;
  - (void)attachBridge;
  @end
OBJC
APP_DELEGATE_ATTACH_CALL = '    [[AgoraRtcPlugin sharedInstance] attachBridge];'
IOS_RTC_USAGE_DESCRIPTIONS = {
  'NSCameraUsageDescription' => 'Agora RTC needs camera access for local video preview and calls.',
  'NSMicrophoneUsageDescription' => 'Agora RTC needs microphone access for voice calls.'
}.freeze

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

def remove_legacy_build_locations_for_swift_packages(project)
  legacy_keys = %w[
    SYMROOT
    OBJROOT
    CONFIGURATION_BUILD_DIR
    CONFIGURATION_TEMP_DIR
  ]
  configurations = project.build_configurations + project.targets.flat_map(&:build_configurations)

  configurations.each do |configuration|
    legacy_keys.each { |key| configuration.build_settings.delete(key) }
  end
end

def remove_stale_swift_package_products(target, frameworks_phase, package_ref, package_product_names)
  allowed = package_product_names
  stale_dependencies = target.package_product_dependencies.select do |dependency|
    dependency.package == package_ref && !allowed.include?(dependency.product_name)
  end

  stale_dependencies.each do |dependency|
    frameworks_phase.files
      .select { |file| file.product_ref == dependency }
      .each(&:remove_from_project)

    target.package_product_dependencies.delete(dependency)
    dependency.remove_from_project
  end
end

def ensure_swift_package_product(project, target, frameworks_phase, package_ref, package_product_name)
  package_product = target.package_product_dependencies.find do |dependency|
    dependency.product_name == package_product_name
  end

  unless package_product
    package_product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    package_product.package = package_ref
    package_product.product_name = package_product_name
    target.package_product_dependencies << package_product
  end

  return if frameworks_phase.files.any? { |file| file.product_ref == package_product }

  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = package_product
  frameworks_phase.files << build_file
end

def remove_swift_package_product(target, frameworks_phase, package_product_name)
  package_product = target.package_product_dependencies.find do |dependency|
    dependency.product_name == package_product_name
  end

  frameworks_phase.files
    .select { |file| file.product_ref && file.product_ref.display_name == package_product_name }
    .each(&:remove_from_project)

  if package_product
    target.package_product_dependencies.delete(package_product)
    package_product.remove_from_project
  end
end

def rewrite_cocos_archive_linker_flags(target)
  target.build_configurations.each do |configuration|
    flags = configuration.build_settings['OTHER_LDFLAGS']
    next unless flags

    flag_list = flags.is_a?(Array) ? flags : [flags]
    rewritten = flag_list.map do |flag|
      flag.to_s
          .sub(
            %r{.*/archives/#{Regexp.escape(configuration.name)}/libcocos_engine\.a\z},
            '$(CONFIGURATION_BUILD_DIR)/libcocos_engine.a'
          )
          .sub(
            %r{.*/boost/container/archives/#{Regexp.escape(configuration.name)}/libboost_container\.a\z},
            '$(CONFIGURATION_BUILD_DIR)/libboost_container.a'
          )
    end

    configuration.build_settings['OTHER_LDFLAGS'] = flags.is_a?(Array) ? rewritten : rewritten.join(' ')
  end
end

def ensure_app_frameworks_runpath(target)
  target.build_configurations.each do |configuration|
    existing = configuration.build_settings['LD_RUNPATH_SEARCH_PATHS']
    runpaths = existing.is_a?(Array) ? existing.dup : existing.to_s.split(/\s+/)
    runpaths << '$(inherited)' if runpaths.empty?
    runpaths << '@executable_path/Frameworks' unless runpaths.include?('@executable_path/Frameworks')
    configuration.build_settings['LD_RUNPATH_SEARCH_PATHS'] = runpaths
  end
end

def remove_simulator_launch_assets(target)
  launch_asset_names = ['LaunchScreen.storyboard', 'Images.xcassets']

  target.resources_build_phase.files.dup.each do |build_file|
    file_ref = build_file.file_ref
    next unless file_ref && launch_asset_names.include?(file_ref.display_name)

    build_file.remove_from_project
  end

  target.build_configurations.each do |configuration|
    configuration.build_settings.delete('ASSETCATALOG_COMPILER_APPICON_NAME')
    configuration.build_settings.delete('ASSETCATALOG_COMPILER_LAUNCHSTORYBOARD_NAME')
  end
end

def ensure_info_plist_usage_descriptions(path)
  return unless File.exist?(path)

  content = File.read(path)
  patched = content.dup
  missing_entries = IOS_RTC_USAGE_DESCRIPTIONS.reject do |key, _value|
    patched.include?("<key>#{key}</key>")
  end
  return if missing_entries.empty?

  usage_block = missing_entries.map do |key, value|
    "\t<key>#{key}</key>\n\t<string>#{value}</string>"
  end.join("\n")
  dict_end_index = patched.rindex('</dict>')
  raise 'Unable to patch iOS Info.plist: </dict> anchor not found.' unless dict_end_index

  patched = "#{patched[0...dict_end_index].rstrip}\n#{usage_block}\n#{patched[dict_end_index..]}"
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

common_group = project.main_group.find_subpath(COMMON_GROUP_NAME, true)
common_group.set_source_tree('<group>')
common_group.path = COMMON_GROUP_NAME

['AgoraEngineTextureBridge.h', 'AgoraEngineTextureBridge.cpp'].each do |filename|
  source_path = File.join(COMMON_ENGINE_TEXTURE_BRIDGE_DIR, filename)
  next unless File.exist?(source_path)

  file_ref = common_group.files.find { |file| file.path == source_path } || common_group.new_file(source_path)
  target.add_file_references([file_ref]) unless target.source_build_phase.files_references.include?(file_ref)
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

  if IOS_CODE_SIGN_IDENTITY && !IOS_CODE_SIGN_IDENTITY.empty?
    configuration.build_settings['CODE_SIGN_IDENTITY'] = IOS_CODE_SIGN_IDENTITY
  end
end

package_ref = project.root_object.package_references.find do |reference|
  reference.isa == 'XCRemoteSwiftPackageReference' && reference.repositoryURL == PACKAGE_URL
end

frameworks_phase = target.frameworks_build_phase

remove_legacy_build_locations_for_swift_packages(project) if WITH_PACKAGE
rewrite_cocos_archive_linker_flags(target)
ensure_app_frameworks_runpath(target)

if WITH_PACKAGE
  unless package_ref
    package_ref = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
    package_ref.repositoryURL = PACKAGE_URL
    project.root_object.package_references << package_ref
  end

  package_ref.requirement = {
    'kind' => 'exactVersion',
    'version' => PACKAGE_VERSION,
  }

  remove_stale_swift_package_products(target, frameworks_phase, package_ref, PACKAGE_PRODUCTS)

  PACKAGE_PRODUCTS.each do |package_product_name|
    ensure_swift_package_product(project, target, frameworks_phase, package_ref, package_product_name)
  end
else
  PACKAGE_PRODUCTS.each do |package_product_name|
    remove_swift_package_product(target, frameworks_phase, package_product_name)
  end

  if package_ref
    project.root_object.package_references.delete(package_ref)
    package_ref.remove_from_project
  end
end

remove_simulator_launch_assets(target) if SKIP_SIMULATOR_LAUNCH_ASSETS

project.save
ensure_app_delegate_attaches_bridge(APP_DELEGATE_PATH)
ensure_info_plist_usage_descriptions(INFO_PLIST_PATH)
puts "Integrated Agora bridge files into #{PROJECT_PATH}"
