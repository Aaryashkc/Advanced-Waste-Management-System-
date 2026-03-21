import { useRef, useState, useEffect } from "react"

export default function ScrollTriggered() {
    return (
        <div style={container}>
            {food.map(([emoji, hueA, hueB], i) => (
                <Card i={i} emoji={emoji} hueA={hueA} hueB={hueB} key={emoji} />
            ))}
        </div>
    )
}

function Card({ emoji, hueA, hueB, i }) {
    const [isInView, setIsInView] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsInView(true)
            },
            { threshold: 0.8 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const background = `linear-gradient(306deg, ${hue(hueA)}, ${hue(hueB)})`

    return (
        <div
            ref={ref}
            className={`card-container-${i}`}
            style={cardContainer}
        >
            <div style={{ ...splash, background }} />
            <div
                style={{
                    ...card,
                    transform: isInView
                        ? "translateY(50px) rotate(-10deg)"
                        : "translateY(300px) rotate(0deg)",
                    transition:
                        "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
                className="card"
            >
                {emoji}
            </div>
        </div>
    )
}

const hue = (h) => `hsl(${h}, 100%, 50%)`

/**
 * ==============   Styles   ================
 */

const container = {
    margin: "100px auto",
    maxWidth: 500,
    paddingBottom: 100,
    width: "100%",
}

const cardContainer = {
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    paddingTop: 20,
    marginBottom: -120,
}

const splash = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    clipPath: `path("M 0 303.5 C 0 292.454 8.995 285.101 20 283.5 L 460 219.5 C 470.085 218.033 480 228.454 480 239.5 L 500 430 C 500 441.046 491.046 450 480 450 L 20 450 C 8.954 450 0 441.046 0 430 Z")`,
}

const card = {
    fontSize: 164,
    width: 300,
    height: 430,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    background: "#f5f5f5",
    boxShadow:
        "0 0 1px hsl(0deg 0% 0% / 0.075), 0 0 2px hsl(0deg 0% 0% / 0.075), 0 0 4px hsl(0deg 0% 0% / 0.075), 0 0 8px hsl(0deg 0% 0% / 0.075), 0 0 16px hsl(0deg 0% 0% / 0.075)",
    transformOrigin: "10% 60%",
}

/**
 * ==============   Data   ================
 */

const food = [
    ["🍅", 340, 10],
    ["🍊", 20, 40],
    ["🍋", 60, 90],
    ["🍐", 80, 120],
    ["🍏", 100, 140],
    ["🫐", 205, 245],
    ["🍆", 260, 290],
    ["🍇", 290, 320],
]
