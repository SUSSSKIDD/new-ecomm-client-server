import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

const InteractiveHoverButton = React.forwardRef(({ text = "Button", className, ...props }, ref) => {
    return (
        <button
            ref={ref}
            className={cn(
                "group relative w-full cursor-pointer overflow-hidden rounded-lg border bg-ud-primary p-3 text-center font-bold text-white shadow-lg shadow-green-500/30",
                className,
            )}
            {...props}
        >
            <span className="inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
                {text}
            </span>
            <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100">
                <span>{text}</span>
                <ArrowRight className="w-5 h-5" />
            </div>
            <div className="absolute left-[20%] top-[40%] h-2 w-2 scale-[1] rounded-lg bg-emerald-600 transition-all duration-300 group-hover:left-[0%] group-hover:top-[0%] group-hover:h-full group-hover:w-full group-hover:scale-[1.8] group-hover:bg-emerald-600"></div>
        </button>
    );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
