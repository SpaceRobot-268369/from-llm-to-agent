import { SECTIONS } from './content/sections';
import { PixelField } from './engine/PixelField';
import { ChapterCard } from './components/ChapterCard';
import { Credits, Finale } from './components/Finale';
import { Hero } from './components/Hero';
import { Loader } from './components/Loader';
import { BackToTop, ProgressRail, StackTrail, TopBar } from './components/Hud';
import { ScalingSection } from './components/ScalingSection';
import { Section } from './components/Section';

export default function App() {
  return (
    <>
      <PixelField />
      <TopBar />
      <ProgressRail />
      <StackTrail />
      <BackToTop />
      <main>
        {SECTIONS.map((s, i) =>
          s.kind === 'hero' ? (
            <Hero key={s.id} s={s} index={i} />
          ) : s.kind === 'part' ? (
            <ChapterCard key={s.id} s={s} index={i} />
          ) : s.kind === 'scaling' ? (
            <ScalingSection key={s.id} s={s} index={i} />
          ) : s.kind === 'finale' ? (
            <Finale key={s.id} s={s} index={i} />
          ) : (
            <Section key={s.id} s={s} index={i} />
          ),
        )}
      </main>
      <Credits />
      <Loader />
    </>
  );
}
