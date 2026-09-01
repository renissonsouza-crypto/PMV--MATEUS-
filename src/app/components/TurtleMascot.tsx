import { useId } from "react";

export function TurtleMascot({ size = 55, className = "" }: { size?: number; className?: string }) {
  const id = `tortuguita-${useId().replace(/:/g, "")}`;

  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} role="img" aria-label="Tortuguita Vix, mascote do Qualifica Vix">
      <defs>
        <linearGradient id={`${id}-skin`} x1="32" y1="12" x2="100" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#91DEF8"/><stop offset=".52" stopColor="#46B5E8"/><stop offset="1" stopColor="#1A7FC1"/>
        </linearGradient>
        <linearGradient id={`${id}-shell`} x1="91" y1="58" x2="123" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE873"/><stop offset=".5" stopColor="#FFCA28"/><stop offset="1" stopColor="#F39A16"/>
        </linearGradient>
        <linearGradient id={`${id}-belly`} x1="67" y1="70" x2="67" y2="122" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFCE9"/><stop offset="1" stopColor="#EED486"/>
        </linearGradient>
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="160%" height="175%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#082F60" floodOpacity=".28"/>
        </filter>
        <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="1.8"/></filter>
      </defs>

      <ellipse cx="70" cy="131" rx="43" ry="5.5" fill="#0A376A" opacity=".2" filter={`url(#${id}-blur)`}/>
      <g filter={`url(#${id}-shadow)`} stroke="#082F60" strokeLinejoin="round">
        {/* Casco lateral amarelo, como na referência */}
        <path d="M77 59C108 50 130 72 128 98C127 113 115 121 97 120L79 104Z" fill={`url(#${id}-shell)`} strokeWidth="3.2"/>
        <path d="M95 61C90 76 90 96 97 115M112 67C104 82 105 103 114 112M89 77L124 85M90 97L125 101" stroke="#C77909" strokeWidth="2" strokeLinecap="round"/>
        <path d="M98 64C104 68 108 74 109 80C102 83 96 81 91 76C92 70 94 66 98 64Z" fill="#FFDB4A" stroke="#C77909" strokeWidth="1.4"/>
        <path d="M110 83C117 83 121 87 124 92C122 97 118 100 112 100C107 96 106 89 110 83Z" fill="#FFC52D" stroke="#C77909" strokeWidth="1.4"/>
        <path d="M97 84C103 80 109 81 112 86C110 92 105 97 99 98C95 94 94 89 97 84Z" fill="#FFD342" stroke="#C77909" strokeWidth="1.4"/>

        {/* Corpo, braços e barriga clara */}
        <path d="M44 69C30 75 25 93 30 105C33 113 41 112 46 104L53 82Z" fill={`url(#${id}-skin)`} strokeWidth="3"/>
        <path d="M87 70C101 75 107 90 102 102C99 110 91 107 87 100L81 82Z" fill={`url(#${id}-skin)`} strokeWidth="3"/>
        <path d="M32 98C35 101 40 102 45 99M91 97C95 100 99 99 102 96" stroke="#126BA8" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M45 67C39 80 39 99 45 112C51 125 82 125 91 111C97 99 95 79 87 67Z" fill={`url(#${id}-skin)`} strokeWidth="3"/>
        <path d="M53 70C48 84 50 105 57 115C62 121 76 120 81 113C87 102 88 83 82 70C72 75 62 75 53 70Z" fill={`url(#${id}-belly)`} stroke="#D2B458" strokeWidth="2"/>
        <path d="M51 88H85M52 101H84" stroke="#D2B458" strokeWidth="1.5" opacity=".75"/>

        {/* Pés */}
        <path d="M44 106C36 112 34 124 39 129C45 133 58 130 61 125L60 111Z" fill={`url(#${id}-skin)`} strokeWidth="3"/>
        <path d="M80 111L78 125C82 132 96 133 101 127C104 120 98 109 92 106Z" fill={`url(#${id}-skin)`} strokeWidth="3"/>
        <path d="M43 121L42 127M50 121V128M56 120L57 126M85 121L84 127M92 121V128M98 119L100 126" stroke="#126BA8" strokeWidth="2" strokeLinecap="round"/>

        {/* Cabeça grande e expressiva */}
        <path d="M29 40C29 18 46 6 68 6C92 6 107 21 106 42C105 63 91 78 68 79C44 79 29 63 29 40Z" fill={`url(#${id}-skin)`} strokeWidth="3.5"/>
        <path d="M38 29C43 18 55 12 67 12" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".42"/>

        {/* Olhos grandes */}
        <ellipse cx="48" cy="38" rx="11.5" ry="15.5" fill="white" strokeWidth="2.6"/>
        <ellipse cx="87" cy="38" rx="11.5" ry="15.5" fill="white" strokeWidth="2.6"/>
        <ellipse cx="51" cy="40" rx="6.5" ry="10.5" fill="#101C36" stroke="none"/>
        <ellipse cx="84" cy="40" rx="6.5" ry="10.5" fill="#101C36" stroke="none"/>
        <ellipse cx="53" cy="35" rx="2.8" ry="3.4" fill="white" stroke="none"/><ellipse cx="86" cy="35" rx="2.8" ry="3.4" fill="white" stroke="none"/>
        <circle cx="49" cy="45" r="1.2" fill="#61C9EF" stroke="none"/><circle cx="82" cy="45" r="1.2" fill="#61C9EF" stroke="none"/>

        {/* Rosto sorridente */}
        <ellipse cx="67.5" cy="54" rx="17" ry="10.5" fill="#69C9EC" stroke="none" opacity=".88"/>
        <circle cx="40" cy="56" r="3.8" fill="#F58BA8" stroke="none" opacity=".58"/><circle cx="96" cy="56" r="3.8" fill="#F58BA8" stroke="none" opacity=".58"/>
        <circle cx="63" cy="51" r="1.4" fill="#175B8D" stroke="none"/><circle cx="72" cy="51" r="1.4" fill="#175B8D" stroke="none"/>
        <path d="M55 57C59 69 76 70 81 57C75 61 62 61 55 57Z" fill="white" strokeWidth="2"/>
        <path d="M62 65C66 62 72 62 76 65C73 69 65 70 62 65Z" fill="#F17791" stroke="none"/>

        <g fill="#167AB5" stroke="none" opacity=".55">
          <circle cx="38" cy="66" r="1.8"/><circle cx="44" cy="70" r="1.4"/><circle cx="97" cy="66" r="1.8"/>
          <circle cx="90" cy="71" r="1.4"/><circle cx="36" cy="91" r="1.5"/><circle cx="99" cy="89" r="1.5"/>
          <circle cx="48" cy="82" r="1.3"/><circle cx="87" cy="83" r="1.3"/><circle cx="48" cy="115" r="1.2"/><circle cx="91" cy="114" r="1.2"/>
        </g>
      </g>
    </svg>
  );
}
