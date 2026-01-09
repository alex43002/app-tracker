export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-center bg-white px-16">
      <h1 className="text-3xl font-semibold mb-4">
        CareerLog
      </h1>

      <p className="text-gray-700 text-lg mb-6">
        Take control of your job search.
      </p>

      <ul className="space-y-4 text-gray-600">
        <li>• Track every application in one place</li>
        <li>• Visualize your interview pipeline</li>
        <li>• Never miss a follow-up</li>
        <li>• Built for serious job seekers</li>
      </ul>

      <p className="mt-10 text-sm text-gray-500 max-w-md">
        Your data is private, encrypted, and never shared. CareerLog
        exists to help you stay organized—not to sell your information.
      </p>
    </div>
  );
}
