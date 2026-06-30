import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, 
  MapPin, 
  CheckCircle, 
  Trophy, 
  ChevronRight, 
  Sparkles, 
  Info, 
  BadgeAlert,
  ChevronLeft,
  Award
} from "lucide-react";
import { Issue, User } from "../types";

interface GamePanelProps {
  issues: Issue[];
  currentUser: User | null;
  onGoToReport: () => void;
}

export default function GamePanel({ issues, currentUser, onGoToReport }: GamePanelProps) {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);
  const [currentTriviaIndex, setCurrentTriviaIndex] = useState(0);
  const [selectedTriviaAnswer, setSelectedTriviaAnswer] = useState<number | null>(null);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaFinished, setTriviaFinished] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);

  // Real user reports count for Motivation
  const userReportsCount = useMemo(() => {
    if (!currentUser) return 0;
    return issues.filter(i => i.reporterId === currentUser.uid).length;
  }, [issues, currentUser]);

  const triviaQuestions = {
    easy: [
      {
        question: "What is the primary cause of potholes forming on city roads?",
        options: [
          "Heavy pedestrian walking",
          "Water entering road cracks, freezing, and expanding",
          "High solar rays breaking concrete",
          "Improper tire air pressure"
        ],
        correctIndex: 1,
        explanation: "Water enters small cracks in the pavement. When it freezes, it expands, pushing up the road. Traffic then breaks this weakened surface, forming a pothole."
      },
      {
        question: "Which of the following is highly recyclable and can be processed back into the same product infinitely?",
        options: [
          "Greasy pizza cardboard",
          "Aluminum beverage cans",
          "Single-use plastic bags",
          "Used paper napkins"
        ],
        correctIndex: 1,
        explanation: "Aluminum is 100% recyclable and can be recycled indefinitely without losing quality. Over 75% of all aluminum ever produced is still in use today!"
      },
      {
        question: "What is the correct civic emergency phone number to report active gas leaks, downed wires, or structure fires?",
        options: [
          "311 (Non-emergency)",
          "911 (Emergency)",
          "411 (Information)",
          "811 (Call before you dig)"
        ],
        correctIndex: 1,
        explanation: "Active gas leaks, live sparking wires, and structural fires are life-threatening emergencies. Call 911 immediately. Use 311 for non-emergencies."
      },
      {
        question: "Turning off the tap while brushing your teeth can save roughly how much water per minute?",
        options: [
          "Less than 1 liter",
          "About 2 liters",
          "Up to 12 liters",
          "Exactly 50 liters"
        ],
        correctIndex: 2,
        explanation: "Standard bathroom taps flow at about 6 to 12 liters per minute. Turning it off while brushing your teeth saves massive amounts of water over time."
      },
      {
        question: "Who is primarily responsible for maintaining and cleaning public street signs?",
        options: [
          "The neighboring business owners",
          "City Public Works Department",
          "State Highway Patrol",
          "The local neighborhood watch"
        ],
        correctIndex: 1,
        explanation: "Street names, stop signs, and speed limit displays are maintained by the municipal Department of Public Works to ensure safe traffic and transit."
      },
      {
        question: "What should you do if you notice a severely cracked public sidewalk that poses a tripping hazard?",
        options: [
          "Ignore it unless someone falls",
          "Try to patch it with home cement",
          "Report it to code enforcement or 311",
          "Draw a circle around it with chalk"
        ],
        correctIndex: 2,
        explanation: "Cities rely on citizen reports to locate broken pavement. Submitting a report via local apps or 311 lets public works schedule timely repairs."
      },
      {
        question: "What is the main benefit of modern LED streetlights compared to older yellow sodium lamps?",
        options: [
          "They change colors for holidays",
          "They consume up to 60% less energy and last much longer",
          "They attract more local birds",
          "They generate heat to melt snow"
        ],
        correctIndex: 1,
        explanation: "LEDs offer superior energy efficiency, lowering municipal electricity bills, decreasing carbon footprints, and improving night-time traffic safety."
      },
      {
        question: "Which of these items should NOT go into the standard blue curbside recycling bin?",
        options: [
          "Clean cardboard boxes",
          "Plastic water bottles",
          "Greasy, cheese-stained pizza boxes",
          "Clean aluminum foil"
        ],
        correctIndex: 2,
        explanation: "Food grease and oils contaminate paper fibers during reprocessing. Clean sections of cardboard can be recycled, but greasy parts belong in trash or compost."
      },
      {
        question: "Most city noise ordinances define quiet hours starting at what typical time on weeknights?",
        options: [
          "6:00 PM",
          "8:00 PM",
          "10:00 PM or 11:00 PM",
          "Midnight"
        ],
        correctIndex: 2,
        explanation: "To protect community sleep and health, standard municipal codes designate quiet hours beginning at 10:00 PM or 11:00 PM and running until 7:00 AM."
      },
      {
        question: "How many feet of space must vehicles typically park away from a fire hydrant?",
        options: [
          "3 feet",
          "5 feet",
          "15 feet",
          "30 feet"
        ],
        correctIndex: 2,
        explanation: "Standard fire codes require leaving 15 feet (4.5 meters) clear around fire hydrants so emergency crews can instantly access water sources during fires."
      },
      {
        question: "What is the safest way to report an aggressive stray animal in a public park?",
        options: [
          "Try to capture it yourself",
          "Ignore it and walk away",
          "Call municipal Animal Control or non-emergency services",
          "Post a warning on social media"
        ],
        correctIndex: 2,
        explanation: "Professional Animal Control officers have the training, vaccinations, and specialized tools to safely relocate stray or distressed animals."
      },
      {
        question: "Why is it illegal and harmful to pour motor oil or chemical paint down street storm drains?",
        options: [
          "It makes the storm drains smell bad",
          "Storm drains flow directly into local water bodies untreated",
          "It causes the street tarmac to melt",
          "It attracts rodents to the sewer"
        ],
        correctIndex: 1,
        explanation: "Unlike household sinks which connect to wastewater plants, storm drains empty directly into local rivers, streams, and lakes without any treatment."
      },
      {
        question: "In most municipalities, who is legally responsible for shoveling snow off the public sidewalk adjacent to a house?",
        options: [
          "The postal service",
          "The city road crews",
          "The homeowner or occupant of the property",
          "Nobody, it is left to melt"
        ],
        correctIndex: 2,
        explanation: "Local bylaws almost universally place the responsibility of clearing ice and snow from bordering public walkways on the adjacent property owner or occupant."
      },
      {
        question: "What is the primary danger of leaving open garbage bags on the curb days before the scheduled trash pickup?",
        options: [
          "Wind blowing bags into tree branches",
          "Pests like rats and stray animals tearing bags and spreading waste",
          "The bags melting under summer sun",
          "Garbage truck drivers refusing to stop"
        ],
        correctIndex: 1,
        explanation: "Premature waste disposal attracts pests like raccoons, rodents, and stray dogs, scattering garbage, spreading disease, and clogging storm grates."
      },
      {
        question: "If a neighbor's tree has branches hanging over your property line, what is generally the rule?",
        options: [
          "You must hire the neighbor to cut it",
          "You can trim the branches up to your property boundary line",
          "You cannot touch it without a court order",
          "The tree must be completely cut down"
        ],
        correctIndex: 1,
        explanation: "Property owners generally hold the legal right to prune branches or roots crossing their property line, provided they do not permanently damage the tree."
      }
    ],
    medium: [
      {
        question: "How many liters of water can a single continuously running toilet waste per day?",
        options: [
          "Up to 50 liters",
          "Up to 200 liters",
          "Up to 750 liters",
          "Up to 1,000 liters or more"
        ],
        correctIndex: 3,
        explanation: "A leaky toilet flapper or fill valve can waste over 1,000 liters of potable water daily. It is a major contributor to high household utility bills."
      },
      {
        question: "What is the recommended safe distance to keep from a fallen, sparking utility power line?",
        options: [
          "At least 10 meters (33 feet)",
          "Exactly 3 meters (10 feet)",
          "Just hop over it carefully",
          "1 meter (3 feet)"
        ],
        correctIndex: 0,
        explanation: "Electricity spreads through the ground in concentric circles of decreasing voltage. Stay at least 10 meters away—the length of a full public bus."
      },
      {
        question: "What percentage of long-term city budget is saved by patching a pothole early instead of completely repaving?",
        options: [
          "Less than 5%",
          "Around 25%",
          "Up to 50%",
          "Over 70%"
        ],
        correctIndex: 3,
        explanation: "Patching small asphalt cracks stops water from dissolving the subgrade foundation, saving the municipality over 70% compared to heavy resurfacing."
      },
      {
        question: "Which department of a municipal government is typically responsible for maintaining urban street trees and canopy coverage?",
        options: [
          "The Animal Control Division",
          "Department of Parks & Recreation / Public Works",
          "The City Treasury",
          "The Health and Sanitation Board"
        ],
        correctIndex: 1,
        explanation: "Urban forestry, sidewalk tree inspections, and roadside vegetation control are usually run by municipal Parks and Recreation or Public Works."
      },
      {
        question: "Which of the following organic materials is highly recommended for backyard composting bins?",
        options: [
          "Cooked meat and bones",
          "Dairy products and cheese",
          "Fruit peelings, vegetable scraps, and coffee grounds",
          "Pet waste and cat litter"
        ],
        correctIndex: 2,
        explanation: "Vegetable scrap, eggshells, coffee grounds, and dry leaves compost quickly without producing the rancid smells that attract rodents and coyotes."
      },
      {
        question: "What does 'ADA Compliant' mean when applied to newly constructed municipal sidewalks?",
        options: [
          "Aligned Drainage Asphalt",
          "Americans with Disabilities Act standards for accessibility",
          "Automated Detection Assembly for traffic",
          "Association of District Architects design guidelines"
        ],
        correctIndex: 1,
        explanation: "ADA compliance ensures sidewalks feature wheelchair ramps, visual-tactile warning domes, and manageable grades to guarantee universal transit access."
      },
      {
        question: "Why do densely populated urban areas experience the 'Urban Heat Island' effect?",
        options: [
          "Large populations breathing closely",
          "Dark asphalt, roofs, and concrete absorbing and re-radiating heat",
          "Air conditioners blowing hot exhaust outdoors",
          "Lack of wind due to high-rise building clusters"
        ],
        correctIndex: 1,
        explanation: "Built infrastructure uses materials like dark tarmac and concrete which store thermal energy during the day and release it slowly at night."
      },
      {
        question: "A sudden, major drop in tap water pressure across an entire residential zone usually indicates:",
        options: [
          "A neighbor watering their lawn",
          "A municipal water main rupture",
          "The water treatment plant undergoing cleaning",
          "An empty reservoir due to cloudless weather"
        ],
        correctIndex: 1,
        explanation: "Water networks are heavily pressurized. A sudden regional drop in flow points to a major pipe burst letting thousands of gallons leak underground."
      },
      {
        question: "What is the primary objective of streetlights being 'Dark Sky' compliant?",
        options: [
          "To keep streets darker to reduce crime",
          "To redirect light downward to reduce light pollution and protect wildlife",
          "To turn off automatically when sensors detect moonlight",
          "To save bulb costs by using lower wattage"
        ],
        correctIndex: 1,
        explanation: "Dark Sky fixtures shield bulbs to shine light only where needed, preventing artificial light scatter from blinding wildlife and blocking starlight."
      },
      {
        question: "How long does it take for standing water in puddles, abandoned tires, or birdbaths to breed mosquitoes?",
        options: [
          "Within 12 hours",
          "Between 7 to 10 days",
          "Exactly 1 month",
          "At least 3 months"
        ],
        correctIndex: 1,
        explanation: "Mosquito eggs hatch and transform into flying, disease-carrying adults in stagnant, unmoving water in as little as one week."
      },
      {
        question: "How often do municipal fire departments recommend testing home smoke detector alarms?",
        options: [
          "Once a week",
          "Once a month",
          "Once a year",
          "Only when the low-battery beep sounds"
        ],
        correctIndex: 1,
        explanation: "Testing smoke detectors monthly guarantees the internal battery and speaker are functional, which reduces fire-related casualties significantly."
      },
      {
        question: "What is the proper way to dispose of household hazardous waste like paint thinners, motor oil, and batteries?",
        options: [
          "Wrap them in newspaper and put them in regular trash",
          "Take them to a local designated hazardous waste drop-off facility",
          "Pour them into backyard soil where they biodegrade",
          "Flush them down the household toilet"
        ],
        correctIndex: 1,
        explanation: "Hazardous waste must be delivered to special processing sites to keep chemical toxins out of local groundwater tables or regular landfills."
      },
      {
        question: "What type of development does residential zoning code 'R-1' typically protect and allow?",
        options: [
          "Heavy industrial manufacturing and chemical plants",
          "High-rise apartment complexes with retail space",
          "Single-family detached residential homes",
          "Public parks and recreational sports complexes"
        ],
        correctIndex: 2,
        explanation: "R-1 zoning stands for Low-Density Single-Family Residential, which restricts developers from building multi-unit towers or factories."
      },
      {
        question: "What is a municipal or utility easement on a residential property deed?",
        options: [
          "A tax discount for planting trees",
          "A legal right allowing utility workers to access and maintain public infrastructure on private land",
          "The right to expand private driveways into city streets",
          "An agreement to allow neighbors to walk across your lawn"
        ],
        correctIndex: 1,
        explanation: "An easement gives water, sewer, power, or internet operators access to specific paths of your property to install or repair civic lines."
      },
      {
        question: "What is the main contributor to ground-level ozone (smog) in urban centers during hot summer months?",
        options: [
          "Decaying organic material in forest parks",
          "Vehicle and industrial emissions reacting with sunlight and heat",
          "Dust blowing from agricultural fields",
          "High levels of oxygen released by garden plants"
        ],
        correctIndex: 1,
        explanation: "Sunlight and heavy summer heat trigger chemical reactions between fossil fuel vehicle emissions and organic gases, creating thick smog."
      }
    ],
    hard: [
      {
        question: "What occurs during a 'Combined Sewer Overflow' (CSO) event in older cities?",
        options: [
          "Raw sewage flows backward into home basements",
          "Stormwater and raw sewage mix during heavy rain and discharge directly into local waterways",
          "Water lines burst due to pressure spikes from storms",
          "Sewer treatment facilities lose electrical power"
        ],
        correctIndex: 1,
        explanation: "In older single-pipe sewer networks, heavy rain overloads wastewater capacity, forcing the system to vent mixed rain and sewage directly into rivers."
      },
      {
        question: "In urban planning, what is 'Traffic Calming'?",
        options: [
          "Giving free transit tickets to angry drivers",
          "Designing roads with physical features like chicanes, speed humps, and neckdowns to slow down cars",
          "Increasing highway speed limits to clear congestion",
          "Installing soothing music speakers along highways"
        ],
        correctIndex: 1,
        explanation: "Traffic calming uses deliberate physical modifications—like bulb-outs, traffic circles, and speed tables—to slow neighborhood traffic speeds naturally."
      },
      {
        question: "What plumbing safety device prevents contaminated water from a lawn sprinkler system from backing up into the municipal drinking supply?",
        options: [
          "A standard ball valve",
          "A pressure relief valve",
          "A backflow preventer assembly",
          "A sewer gate valve"
        ],
        correctIndex: 2,
        explanation: "Backflow preventers ensure water only travels into the property. If water main pressure drops, it seals off so lawn chemicals don't siphon backwards."
      },
      {
        question: "In green building codes, what constitutes 'Graywater'?",
        options: [
          "Raw sewage from toilets and bidets",
          "Rainwater collected from copper rooftops",
          "Wastewater from baths, sinks, washing machines, and showers",
          "Water containing industrial solvents and heavy metals"
        ],
        correctIndex: 2,
        explanation: "Graywater excludes sanitary toilet waste. It contains low levels of organic matter and is ideal for recycling on-site for garden soil irrigation."
      },
      {
        question: "What is the legal power of 'Eminent Domain' held by municipal and state governments?",
        options: [
          "The right to ignore federal environmental mandates",
          "The power to take private property for public use with fair market compensation",
          "The power to set interest rates on local banks",
          "The right to tax residents without representation"
        ],
        correctIndex: 1,
        explanation: "Under constitutional law, Eminent Domain lets public bodies purchase private parcels to build infrastructure like public transit lines, paying fair value."
      },
      {
        question: "What does a 'LEED' certification signify for a newly built public administration building?",
        options: [
          "Low-Emission Emergency Design standard for earthquakes",
          "Leadership in Energy and Environmental Design green-rating compliance",
          "Legal Enforcement of District Zoning regulations",
          "Local Economic and Employment Development grant award"
        ],
        correctIndex: 1,
        explanation: "LEED is a global rating program assessing sustainable site design, water efficiency, renewable materials, and indoor environmental air health."
      },
      {
        question: "What is the primary urban runoff benefit of installing 'permeable pavement' systems?",
        options: [
          "They are 50% cheaper to lay down than standard asphalt",
          "They allow rainwater to drain through the surface, reducing storm sewer load and filtering silt",
          "They completely eliminate road noise from speeding cars",
          "They can withstand double the vehicle weight load of concrete"
        ],
        correctIndex: 1,
        explanation: "Permeable pavements let water filter directly into the soil underneath, mimicking natural hydrology, recharging water tables, and curbing road runoff peaks."
      },
      {
        question: "What represents the primary regulatory and safety conflict regarding dockless micro-mobility (e-scooters) in cities?",
        options: [
          "High electric consumption overloading power grids",
          "Scooters cluttering sidewalks, blocking pedestrian right-of-way and ADA ramps",
          "Lack of proper GPS tracking causing vehicle theft",
          "Scooter batteries interfering with street light sensors"
        ],
        correctIndex: 1,
        explanation: "Improperly parked scooters block sidewalk paths, causing severe navigation hazards for wheelchair users, stroller pushers, and blind pedestrians."
      },
      {
        question: "What is the typical structural design lifespan of modern cast-iron or ductile-iron municipal water mains?",
        options: [
          "10 to 15 years",
          "25 to 30 years",
          "75 to 100 years",
          "Over 500 years"
        ],
        correctIndex: 2,
        explanation: "Iron water pipes are designed to last roughly a century. Replacing these aging pipelines remains one of the largest capital costs for cities globally."
      },
      {
        question: "How do the inductive loop sensors buried beneath the asphalt near traffic lights detect a car waiting at an intersection?",
        options: [
          "By measuring the physical weight of the vehicle",
          "By registering a change in magnetic inductance caused by the steel chassis",
          "By using high-frequency sonar sound waves",
          "By measuring the thermal heat of the car engine"
        ],
        correctIndex: 1,
        explanation: "Loop detectors are underground wire coils carrying a weak electric charge. A large steel chassis overhead alters the electrical field, alerting the signal."
      },
      {
        question: "What is a major advantage of municipal 'Smart Water Meters' over traditional mechanical meters?",
        options: [
          "They automatically filter tap water for the consumer",
          "They transmit real-time data to identify continuous, low-flow leaks on private properties",
          "They increase water pressure during peak hours",
          "They allow remote control of private valves to shut off during washing"
        ],
        correctIndex: 1,
        explanation: "Smart meters record flow trends hour-by-hour. If water runs non-stop for 24 hours, they trigger automatic text alerts to prevent water damage."
      },
      {
        question: "What are bio-swales in rain gardens specifically engineered to achieve in urban runoff management?",
        options: [
          "To breed useful frogs that eat mosquitoes",
          "To naturally filter heavy metals, oils, and sediment from rainwater using plants and soil",
          "To hold water permanently like a pond for scenic views",
          "To speed up runoff so it enters sewer networks faster"
        ],
        correctIndex: 1,
        explanation: "Bio-swales slow storm runoff, leveraging organic roots, soil strata, and bio-retention to screen out oil, gasoline residues, and road sediments."
      },
      {
        question: "In legal and urban planning terms, what does the 'Right-of-Way' (ROW) encompass?",
        options: [
          "The right of pedestrians to cross any street at any time",
          "The entire strip of public land containing the roadway, shoulders, sidewalks, and utility corridors",
          "A law guaranteeing drivers the right to turn right on red lights",
          "The zoning right to build retail shops adjacent to highways"
        ],
        correctIndex: 1,
        explanation: "ROW is the complete public strip encompassing streets, grassy medians, sidewalks, and underground space designated for gas, fiber, and sewer services."
      },
      {
        question: "Why are older water mains constructed from transite (asbestos-cement) piping generally considered safe for drinking water?",
        options: [
          "Asbestos fibers are highly nutritious for humans",
          "The water pressure prevents the asbestos from breaking",
          "Fibers are bound tightly in the cement matrix and pose risk only when cut/disturbed, releasing airborne dust",
          "Asbestos is naturally water-soluble and dissolves cleanly"
        ],
        correctIndex: 2,
        explanation: "Asbestos is harmful when tiny fibers are inhaled into lung tissue. Ingestion in drinking water does not carry the same hazard, unless the pipe degrades."
      },
      {
        question: "What is 'Tax Increment Financing' (TIF) primarily used for by municipalities?",
        options: [
          "To tax residents based on their total vehicle count",
          "To fund infrastructure in blighted areas using projected future increases in property tax revenues",
          "To provide direct cash payouts to low-income home buyers",
          "To levy a temporary sales tax on public transit rides"
        ],
        correctIndex: 1,
        explanation: "TIF captures future property tax gains within a designated revitalization zone to pay back bonds used for immediate park, road, or utility upgrades."
      }
    ]
  };

  const currentQuestions = activeQuestions;

  const handleAnswerTrivia = (idx: number) => {
    if (selectedTriviaAnswer !== null || !difficulty) return;
    setSelectedTriviaAnswer(idx);
    if (idx === currentQuestions[currentTriviaIndex].correctIndex) {
      setTriviaScore(prev => prev + 1);
    }
  };

  const handleNextTrivia = () => {
    setSelectedTriviaAnswer(null);
    if (currentTriviaIndex < currentQuestions.length - 1) {
      setCurrentTriviaIndex(prev => prev + 1);
    } else {
      setTriviaFinished(true);
    }
  };

  const startLevel = (lvl: "easy" | "medium" | "hard") => {
    const questions = [...triviaQuestions[lvl]];
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = questions[i];
      questions[i] = questions[j];
      questions[j] = temp;
    }
    const selected = questions.slice(0, 10);
    setActiveQuestions(selected);

    setDifficulty(lvl);
    setCurrentTriviaIndex(0);
    setSelectedTriviaAnswer(null);
    setTriviaScore(0);
    setTriviaFinished(false);
  };

  const resetTrivia = () => {
    setDifficulty(null);
    setActiveQuestions([]);
    setCurrentTriviaIndex(0);
    setSelectedTriviaAnswer(null);
    setTriviaScore(0);
    setTriviaFinished(false);
  };

  // Score multiplier based on level difficulty
  const levelMultiplier = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 20;

  return (
    <div className="space-y-6" id="game-dashboard-root">
      
      {/* Upper Status Ribbon / Motivation */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <HelpCircle className="w-24 h-24 text-purple-400 animate-pulse" />
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md">
              The Level-Up Loop
            </span>
            <span className="text-xs text-purple-300 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Real Reports linked to civic knowledge!
            </span>
          </div>
          <h2 className="text-base font-black tracking-tight">Fact or Friction? Civic Arena</h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Test your safety and urban guideline IQ with level-based challenges. Learn real facts and discover how to report issues in your neighborhood.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl shrink-0">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 font-bold text-sm shrink-0">
            {userReportsCount}
          </div>
          <div className="text-left">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Weekly Reports</div>
            <div className="text-xs font-extrabold text-white">
              {userReportsCount > 0 ? "🔥 Perks Active" : "🔒 Base Mode"}
            </div>
          </div>
        </div>
      </div>

      {/* GAME: FACT OR FRICTION (CIVIC TRIVIA) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* If no difficulty selected yet, show level selector */}
        {!difficulty ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">Select Your Difficulty</h2>
                <p className="text-xs text-slate-500">Each level consists of 15 interactive civic and environmental questions.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Easy card */}
              <button
                onClick={() => startLevel("easy")}
                className="group relative overflow-hidden bg-emerald-50/40 hover:bg-emerald-50/80 border border-emerald-100 hover:border-emerald-300 p-5 rounded-2xl text-left transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase rounded-full">
                    Easy Level
                  </span>
                  <Award className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 text-sm">Everyday Civic Rules</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Test your knowledge on common household recycling, emergency call numbers, sidewalk maintenance, and simple water leaks.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  Play Easy <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Medium card */}
              <button
                onClick={() => startLevel("medium")}
                className="group relative overflow-hidden bg-amber-50/40 hover:bg-amber-50/80 border border-amber-100 hover:border-amber-300 p-5 rounded-2xl text-left transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase rounded-full">
                    Medium Level
                  </span>
                  <Award className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 text-sm">Urban Code & Hazards</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dive into ADA accessibility guidelines, electric sparking hazard protocols, urban heat islands, easements, and compost regulations.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  Play Medium <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Hard card */}
              <button
                onClick={() => startLevel("hard")}
                className="group relative overflow-hidden bg-rose-50/40 hover:bg-rose-50/80 border border-rose-100 hover:border-rose-300 p-5 rounded-2xl text-left transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase rounded-full">
                    Hard Level
                  </span>
                  <Award className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 text-sm">Urban Infrastructure & Finance</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Prove your expertise in Combined Sewer Overflows (CSOs), Tax Increment Financing (TIF), traffic signal induction loops, and bio-swales.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                  Play Hard <ChevronRight className="w-4 h-4" />
                </div>
              </button>

            </div>
          </div>
        ) : (
          /* Active game screen */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button 
                  onClick={resetTrivia}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors mr-1"
                  title="Back to Difficulty Selection"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base capitalize flex items-center gap-2">
                    Fact or Friction? 
                    <span className={`text-xs px-2.5 py-0.5 rounded-full uppercase font-bold border ${
                      difficulty === "easy" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                        : difficulty === "medium" 
                        ? "bg-amber-50 text-amber-700 border-amber-100" 
                        : "bg-rose-50 text-rose-700 border-rose-100"
                    }`}>
                      {difficulty}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Fast civic knowledge quiz covering environmental neglect and city rules.</p>
                </div>
              </div>

              {!triviaFinished && (
                <div className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                  Q: {currentTriviaIndex + 1} / {currentQuestions.length}
                </div>
              )}
            </div>

            {!triviaFinished ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Question and Multi-choice List */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150">
                    <span className="text-[10px] uppercase font-black text-slate-400">Current Question</span>
                    <h3 className="font-bold text-slate-800 text-sm mt-1 leading-relaxed">
                      {currentQuestions[currentTriviaIndex].question}
                    </h3>
                  </div>

                  {/* Multiple choices */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentQuestions[currentTriviaIndex].options.map((opt, idx) => {
                      const isSelected = selectedTriviaAnswer === idx;
                      const isCorrect = idx === currentQuestions[currentTriviaIndex].correctIndex;
                      const hasAnswered = selectedTriviaAnswer !== null;

                      let btnClass = "bg-white hover:bg-slate-50/50 border-slate-200 text-slate-700";
                      if (hasAnswered) {
                        if (isCorrect) {
                          btnClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
                        } else if (isSelected) {
                          btnClass = "bg-rose-50 border-rose-300 text-rose-800";
                        } else {
                          btnClass = "bg-white border-slate-150 text-slate-400 opacity-60";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleAnswerTrivia(idx)}
                          disabled={hasAnswered}
                          className={`w-full text-left px-4 py-3 border rounded-xl text-xs transition-all flex items-center justify-between ${btnClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[11px] shrink-0">
                              {["A", "B", "C", "D"][idx]}
                            </span>
                            <span>{opt}</span>
                          </div>
                          
                          {hasAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {hasAnswered && isSelected && !isCorrect && <BadgeAlert className="w-4 h-4 text-rose-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Explanatory Twist Context */}
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                      <Info className="w-4 h-4 text-blue-500" />
                      Educational Fact
                    </h4>
                    
                    <AnimatePresence mode="wait">
                      {selectedTriviaAnswer !== null ? (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="space-y-3"
                        >
                          <div className={`p-2 rounded-lg text-[10px] font-bold ${
                            selectedTriviaAnswer === currentQuestions[currentTriviaIndex].correctIndex
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}>
                            {selectedTriviaAnswer === currentQuestions[currentTriviaIndex].correctIndex 
                              ? "Correct! Well done." 
                              : "Incorrect. Here is the fact:"}
                          </div>
                          <p className="text-slate-600 text-xs leading-relaxed">
                            {currentQuestions[currentTriviaIndex].explanation}
                          </p>
                        </motion.div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">
                          Select an answer to unlock the municipal explanation and safety guidelines.
                        </p>
                      )}
                    </AnimatePresence>
                  </div>

                  {selectedTriviaAnswer !== null && (
                    <button
                      onClick={handleNextTrivia}
                      className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      Next Question <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            ) : (
              /* Quiz Completed screen */
              <div className="text-center max-w-md mx-auto py-8 space-y-6">
                <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <Trophy className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-extrabold text-slate-900 text-lg">Civic Quiz Completed!</h3>
                  <p className="text-xs text-slate-500">
                    You scored <strong className="text-slate-800">{triviaScore} out of {currentQuestions.length}</strong> correct answers on <span className="font-bold text-slate-950 uppercase">{difficulty}</span> mode.
                  </p>
                </div>

                {/* Level Up points description */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs space-y-2 text-slate-600">
                  <div className="font-bold text-slate-800">🎖️ Civic Award Received:</div>
                  <p>Knowledge is power, but active citizenship saves municipal lives and water!</p>
                  <div className="font-mono font-bold text-blue-600 bg-blue-50 py-1.5 rounded-lg">
                    +{(triviaScore * levelMultiplier)} Hero Points Added!
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl text-center space-y-3">
                  <p className="text-xs text-slate-600">
                    "Knowledge is power, but action saves lives. Be a hero—report an issue in your street today."
                  </p>
                  <button
                    onClick={onGoToReport}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Start Reporting on Map
                  </button>
                </div>

                <div className="flex justify-center gap-4 text-xs">
                  <button
                    onClick={resetTrivia}
                    className="text-slate-500 hover:text-slate-700 underline font-semibold"
                  >
                    Try Another Level
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => startLevel(difficulty!)}
                    className="text-slate-500 hover:text-slate-700 underline font-semibold"
                  >
                    Retake This Level
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
