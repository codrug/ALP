
import React from 'react';
import {
    Hero,
    ExamLogos,
    MasterStandard,
    MasteryLoop,
    FeaturePillars,
    The80PercentRule,
    CTASection
} from '../components/landing/Sections';
import { Footer } from '../components/common/Footer';

interface LandingPageProps {
    onSignupClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignupClick }) => (
    <main>
        <Hero onSignupClick={onSignupClick} />
        <ExamLogos />
        <MasterStandard />
        <MasteryLoop />
        <FeaturePillars />
        <The80PercentRule />
        <CTASection onSignupClick={onSignupClick} />
        <Footer />
    </main>
);
