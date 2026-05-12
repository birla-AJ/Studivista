cmake_minimum_required(VERSION 3.13)

project(appmodules)

set(CMAKE_CXX_STANDARD_LIBRARIES "${CMAKE_CXX_STANDARD_LIBRARIES} -lc++_shared")

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
