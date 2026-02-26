import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function Logo({ className = "", ...props }: LogoProps) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {/* Outer Hexagon / Shield representing structure and fitness */}
            <path
                d="M50 5 L93 25 L93 75 L50 95 L7 75 L7 25 Z"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
            />

            {/* Abstract 'A' intersecting 'S' geometry */}
            {/* Left/Upward angle for 'A' */}
            <path
                d="M25 70 L50 20 L60 40"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="square"
                strokeLinejoin="miter"
            />
            {/* Center crossbar and 'S' dynamic curve */}
            <path
                d="M35 50 L65 50 L75 70"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="square"
                strokeLinejoin="miter"
            />

            {/* Accent structural dot */}
            <circle cx="50" cy="80" r="4" fill="currentColor" />
        </svg>
    );
}
