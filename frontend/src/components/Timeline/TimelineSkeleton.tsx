"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function TimelineSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ backgroundColor: "var(--color-charcoal, #1A1A1A)" }}
    >
      {/* Header skeleton */}
      <div
        className="border-b"
        style={{
          backgroundColor: "var(--color-charcoal, #1A1A1A)",
          borderColor: "rgba(138, 138, 130, 0.15)",
        }}
      >
        <div className="max-w-7xl mx-auto py-12 px-4 md:px-8 lg:px-10">
          <div className="animate-pulse space-y-4">
            <div
              className="h-12 rounded-lg w-1/3"
              style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
            />
            <div
              className="h-6 rounded-lg w-2/3"
              style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg"
                  style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls skeleton */}
      <div
        className="sticky top-0 z-50 border-b px-4 md:px-10 py-4"
        style={{
          backgroundColor: "rgba(17, 17, 17, 0.8)",
          borderColor: "rgba(138, 138, 130, 0.15)",
        }}
      >
        <div className="max-w-7xl mx-auto animate-pulse flex items-center justify-between">
          <div
            className="h-10 rounded-lg w-64"
            style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
          />
          <div
            className="h-10 rounded-lg w-48"
            style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
          />
        </div>
      </div>

      {/* Timeline events skeleton */}
      <div className="max-w-7xl mx-auto py-20 px-4 md:px-10">
        <div className="relative space-y-20">
          {/* Vertical line */}
          <div
            className="absolute left-8 top-0 bottom-0 w-[2px]"
            style={{ backgroundColor: "rgba(138, 138, 130, 0.3)" }}
          />

          {[...Array(3)].map((_, groupIndex) => (
            <div key={groupIndex} className="flex justify-start md:gap-10">
              {/* Date marker skeleton */}
              <div className="sticky top-40 flex items-center self-start max-w-xs lg:max-w-sm md:w-full">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: "#8A8A82" }}
                  />
                </div>
                <div
                  className="hidden md:block ml-12 h-12 rounded-lg w-48 animate-pulse"
                  style={{ backgroundColor: "rgba(138, 138, 130, 0.1)" }}
                />
              </div>

              {/* Event cards skeleton */}
              <div className="relative pl-20 md:pl-4 w-full space-y-4">
                {[...Array(2)].map((_, eventIndex) => (
                  <div
                    key={eventIndex}
                    className="animate-pulse rounded-lg p-4 border"
                    style={{
                      backgroundColor: "rgba(17, 17, 17, 0.6)",
                      borderColor: "rgba(138, 138, 130, 0.3)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="h-4 rounded w-24"
                        style={{ backgroundColor: "rgba(138, 138, 130, 0.2)" }}
                      />
                      <div
                        className="h-4 rounded w-16"
                        style={{ backgroundColor: "rgba(138, 138, 130, 0.2)" }}
                      />
                    </div>
                    <div
                      className="h-6 rounded w-3/4 mb-2"
                      style={{ backgroundColor: "rgba(138, 138, 130, 0.2)" }}
                    />
                    <div
                      className="h-4 rounded w-full mb-1"
                      style={{ backgroundColor: "rgba(138, 138, 130, 0.2)" }}
                    />
                    <div
                      className="h-4 rounded w-5/6"
                      style={{ backgroundColor: "rgba(138, 138, 130, 0.2)" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
