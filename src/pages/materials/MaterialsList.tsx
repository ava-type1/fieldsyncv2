import { useState, useEffect } from 'react';
import { Package, Check, ShoppingCart } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Material } from '../../types';

interface MaterialWithProperty extends Material {
  propertyAddress?: string;
  propertyId?: string;
}

export function MaterialsList() {
  const { organization } = useAuthStore();
  const [materials, setMaterials] = useState<MaterialWithProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaterials() {
      if (!organization) return;

      try {
        const { data, error } = await supabase
          .from('materials_lists')
          .select(`
            *,
            property:properties(id, street, city)
          `);

        if (error) throw error;

        // Flatten materials from all lists
        const allMaterials: MaterialWithProperty[] = [];
        (data || []).forEach((list) => {
          const items = list.items || [];
          items.forEach((item: Material) => {
            allMaterials.push({
              ...item,
              propertyId: list.property?.id,
              propertyAddress: list.property
                ? `${list.property.street}, ${list.property.city}`
                : undefined,
            });
          });
        });

        setMaterials(allMaterials);
      } catch (err) {
        console.error('Error fetching materials:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMaterials();
  }, [organization]);

  const handleTogglePurchased = async (materialId: string) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialId
          ? {
              ...m,
              status: m.status === 'purchased' ? 'needed' : 'purchased',
              purchasedAt: m.status === 'purchased' ? undefined : new Date().toISOString(),
            }
          : m
      )
    );
    // TODO: Sync with backend
  };

  const unpurchased = materials.filter((m) => m.status !== 'purchased');
  const purchased = materials.filter((m) => m.status === 'purchased');

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Materials</h1>

      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <Package className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No materials needed</h3>
          <p className="mt-1 text-gray-500">
            Materials from your walk-throughs will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Needed Section */}
          <div>
            <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Needed ({unpurchased.length})
            </h2>

            {unpurchased.length === 0 ? (
              <Card className="text-center py-6 text-gray-500">
                All materials have been purchased!
              </Card>
            ) : (
              <div className="space-y-2">
                {unpurchased.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => handleTogglePurchased(material.id)}
                    className="w-full flex items-center gap-3 p-4 bg-white rounded-lg border text-left"
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{material.name}</p>
                      <p className="text-sm text-gray-500">
                        {material.quantity} {material.unit}
                        {material.propertyAddress && (
                          <span className="ml-2 text-gray-400">
                            • {material.propertyAddress}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        material.category === 'electrical'
                          ? 'bg-yellow-100 text-yellow-700'
                          : material.category === 'plumbing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {material.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purchased Section */}
          {purchased.length > 0 && (
            <div>
              <h2 className="font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Check className="w-5 h-5" />
                Purchased ({purchased.length})
              </h2>

              <div className="space-y-2">
                {purchased.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => handleTogglePurchased(material.id)}
                    className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-lg border text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 opacity-60">
                      <p className="font-medium text-gray-900 line-through">{material.name}</p>
                      <p className="text-sm text-gray-500">
                        {material.quantity} {material.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
